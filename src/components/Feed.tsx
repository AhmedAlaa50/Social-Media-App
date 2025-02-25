import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Heart, MessageCircle, Trash2, Share2, Edit2, Lock, Globe, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author_id: string;
  visibility: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
  likes: { user_id: string }[];
  comments: { id: string }[];
  shared_posts: { user_id: string }[];
  shared_by?: {
    username: string;
    avatar_url: string | null;
  };
}

function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public');

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      // Fetch original posts
      const { data: originalPosts, error: originalError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id (username, avatar_url),
          likes (user_id),
          comments (id),
          shared_posts (user_id)
        `)
        .order('created_at', { ascending: false });

      if (originalError) throw originalError;

      // Fetch shared posts
      const { data: sharedPosts, error: sharedError } = await supabase
        .from('shared_posts')
        .select(`
          post_id,
          profiles:user_id (username, avatar_url),
          posts:post_id (
            *,
            profiles:author_id (username, avatar_url),
            likes (user_id),
            comments (id),
            shared_posts (user_id)
          )
        `)
        .order('created_at', { ascending: false });

      if (sharedError) throw sharedError;

      // Transform shared posts to match the Post interface
      const transformedSharedPosts = sharedPosts
        .filter(share => share.posts) // Filter out any null posts
        .map(share => ({
          ...share.posts,
          shared_by: share.profiles
        }));

      // Combine and sort all posts by creation date
      const allPosts = [...originalPosts, ...transformedSharedPosts]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setPosts(allPosts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const post = {
        author_id: user.id,
        content: newPost,
        image_url: imageUrl || null,
        visibility,
      };

      const { error } = await supabase.from('posts').insert([post]);
      if (error) throw error;

      setNewPost('');
      setImageUrl('');
      setVisibility('public');
      fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
    }
  };

  const toggleLike = async (postId: string) => {
    if (!user) return;

    try {
      const existingLike = posts
        .find(p => p.id === postId)
        ?.likes.some(like => like.user_id === user.id);

      if (existingLike) {
        await supabase
          .from('likes')
          .delete()
          .match({ post_id: postId, user_id: user.id });
      } else {
        await supabase
          .from('likes')
          .insert([{ post_id: postId, user_id: user.id }]);
      }

      fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to like post');
    }
  };

  const sharePost = async (postId: string) => {
    if (!user) return;

    try {
      const alreadyShared = posts
        .find(p => p.id === postId)
        ?.shared_posts.some(share => share.user_id === user.id);

      if (alreadyShared) {
        await supabase
          .from('shared_posts')
          .delete()
          .match({ post_id: postId, user_id: user.id });
      } else {
        await supabase
          .from('shared_posts')
          .insert([{ post_id: postId, user_id: user.id }]);
      }

      fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share post');
    }
  };

  const startEditing = (post: Post) => {
    setEditingPost(post.id);
    setEditContent(post.content);
  };

  const cancelEditing = () => {
    setEditingPost(null);
    setEditContent('');
  };

  const updatePost = async (postId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: editContent })
        .match({ id: postId, author_id: user.id });

      if (error) throw error;
      
      setEditingPost(null);
      setEditContent('');
      fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update post');
    }
  };

  const deletePost = async (postId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .match({ id: postId, author_id: user.id });

      if (error) throw error;
      fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 text-red-500 dark:text-red-400 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {user && (
        <form onSubmit={createPost} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            rows={3}
            required
          />
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Image URL (optional)"
                  className="border border-gray-200 dark:border-gray-700 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'public' | 'friends')}
                className="border border-gray-200 dark:border-gray-700 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="public">Public</option>
                <option value="friends">Friends Only</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-blue-600 dark:bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Post
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              {post.shared_by && (
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <Link to={`/profile/${post.shared_by.username}`} className="hover:text-blue-500 dark:hover:text-blue-400">
                    {post.shared_by.username}
                  </Link>
                  <span>shared this post</span>
                </div>
              )}
              <div className="flex justify-between items-start mb-4">
                <Link
                  to={`/profile/${post.author_id}`}
                  className="flex items-center space-x-3"
                >
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    {post.profiles.avatar_url ? (
                      <img
                        src={post.profiles.avatar_url}
                        alt={post.profiles.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-xl">
                        {post.profiles.username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {post.profiles.username}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </p>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <div className="flex items-center text-gray-500 dark:text-gray-400">
                        {post.visibility === 'public' ? (
                          <Globe className="h-4 w-4" />
                        ) : (
                          <Users className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
                {user && post.author_id === user.id && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEditing(post)}
                      className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => deletePost(post.id)}
                      className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>

              {editingPost === post.id ? (
                <div className="space-y-4">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    rows={3}
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={cancelEditing}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => updatePost(post.id)}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-gray-800 dark:text-gray-200 mb-4 whitespace-pre-wrap">
                    {post.content}
                  </p>
                  {post.image_url && (
                    <div className="mb-4 rounded-lg overflow-hidden">
                      <img
                        src={post.image_url}
                        alt="Post content"
                        className="w-full h-auto"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center space-x-6 text-gray-500 dark:text-gray-400">
                <button
                  onClick={() => toggleLike(post.id)}
                  className={`flex items-center space-x-2 ${
                    user && post.likes.some(like => like.user_id === user.id)
                      ? 'text-red-500 dark:text-red-400'
                      : 'hover:text-red-500 dark:hover:text-red-400'
                  }`}
                >
                  <Heart className="h-5 w-5" />
                  <span>{post.likes.length}</span>
                </button>
                <Link
                  to={`/post/${post.id}`}
                  className="flex items-center space-x-2 hover:text-blue-500 dark:hover:text-blue-400"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>{post.comments.length}</span>
                </Link>
                <button
                  onClick={() => sharePost(post.id)}
                  className={`flex items-center space-x-2 ${
                    user && post.shared_posts.some(share => share.user_id === user.id)
                      ? 'text-green-500 dark:text-green-400'
                      : 'hover:text-green-500 dark:hover:text-green-400'
                  }`}
                >
                  <Share2 className="h-5 w-5" />
                  <span>{post.shared_posts.length}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Feed;