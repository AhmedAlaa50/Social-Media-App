import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Edit2, UserPlus, UserCheck, UserX, Heart, MessageCircle, Share2, Globe, Users, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  visibility: string;
  author_id: string;
  likes: { user_id: string }[];
  comments: { id: string }[];
  shared_posts: { user_id: string }[];
}

interface FriendStatus {
  id: string;
  status: string;
  sender_id: string;
  receiver_id: string;
}

function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [friendStatus, setFriendStatus] = useState<FriendStatus | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    bio: '',
    avatar_url: '',
  });
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
    if (user && id && user.id !== id) {
      checkFriendStatus();
    }
  }, [id, user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProfile(data);
      setEditForm({
        full_name: data.full_name || '',
        bio: data.bio || '',
        avatar_url: data.avatar_url || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    }
  };

  const checkFriendStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('friends')
        .select('*')
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setFriendStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check friend status');
    }
  };

  const fetchUserPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          likes (user_id),
          comments (id),
          shared_posts (user_id)
        `)
        .eq('author_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          bio: editForm.bio,
          avatar_url: editForm.avatar_url,
        })
        .eq('id', user.id);

      if (error) throw error;
      
      setEditing(false);
      fetchProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  const handleFriendRequest = async () => {
    if (!user || !id) return;

    try {
      if (!friendStatus) {
        // Send friend request
        const { error } = await supabase
          .from('friends')
          .insert([{
            sender_id: user.id,
            receiver_id: id,
          }]);

        if (error) throw error;
      } else if (friendStatus.status === 'pending' && friendStatus.receiver_id === user.id) {
        // Accept friend request
        const { error } = await supabase
          .from('friends')
          .update({ status: 'accepted' })
          .eq('id', friendStatus.id);

        if (error) throw error;
      } else {
        // Remove friend or cancel request
        const { error } = await supabase
          .from('friends')
          .delete()
          .eq('id', friendStatus.id);

        if (error) throw error;
      }

      checkFriendStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to handle friend request');
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

      fetchUserPosts();
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

      fetchUserPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share post');
    }
  };

  const startEditingPost = (post: Post) => {
    setEditingPost(post.id);
    setEditPostContent(post.content);
  };

  const cancelEditingPost = () => {
    setEditingPost(null);
    setEditPostContent('');
  };

  const updatePost = async (postId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: editPostContent })
        .match({ id: postId, author_id: user.id });

      if (error) throw error;
      
      setEditingPost(null);
      setEditPostContent('');
      fetchUserPosts();
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
      fetchUserPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post');
    }
  };

  const getFriendActionButton = () => {
    if (!user || user.id === id) return null;

    if (!friendStatus) {
      return (
        <button
          onClick={handleFriendRequest}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          <UserPlus className="h-5 w-5" />
          <span>Add Friend</span>
        </button>
      );
    }

    if (friendStatus.status === 'pending') {
      if (friendStatus.sender_id === user.id) {
        return (
          <button
            onClick={handleFriendRequest}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-md hover:bg-gray-700 dark:hover:bg-gray-600"
          >
            <UserX className="h-5 w-5" />
            <span>Cancel Request</span>
          </button>
        );
      } else {
        return (
          <button
            onClick={handleFriendRequest}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600"
          >
            <UserCheck className="h-5 w-5" />
            <span>Accept Request</span>
          </button>
        );
      }
    }

    return (
      <button
        onClick={handleFriendRequest}
        className="flex items-center space-x-2 px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600"
      >
        <UserX className="h-5 w-5" />
        <span>Remove Friend</span>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-4">
        <div className="bg-red-50 dark:bg-red-900/50 text-red-500 dark:text-red-400 p-4 rounded-lg">
          Profile not found
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 text-red-500 dark:text-red-400 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200">
        <div className="relative h-32 bg-gradient-to-r from-blue-500 to-purple-500">
          <div className="absolute -bottom-16 left-8">
            <div className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 bg-white dark:bg-gray-800 overflow-hidden">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-4xl">
                  {profile.username[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className="absolute top-4 right-4 flex space-x-2">
            {user?.id === profile.id ? (
              <button
                onClick={() => setEditing(!editing)}
                className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              >
                <Edit2 className="h-5 w-5 text-white" />
              </button>
            ) : (
              getFriendActionButton()
            )}
          </div>
        </div>

        <div className="pt-20 px-8 pb-8">
          {editing && user?.id === profile.id ? (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Bio
                </label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Avatar URL
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="url"
                    value={editForm.avatar_url}
                    onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                    className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2"
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {profile.full_name || profile.username}
              </h1>
              <p className="text-gray-500 dark:text-gray-400">@{profile.username}</p>
              {profile.bio && (
                <p className="mt-4 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {profile.bio}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Posts</h2>
        {posts.map((post) => (
          <div key={post.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                  <span>•</span>
                  {post.visibility === 'public' ? (
                    <div className="flex items-center space-x-1">
                      <Globe className="h-4 w-4" />
                      <span>Public</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4" />
                      <span>Friends</span>
                    </div>
                  )}
                </div>
                {user && post.author_id === user.id && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEditingPost(post)}
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
                    value={editPostContent}
                    onChange={(e) => setEditPostContent(e.target.value)}
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    rows={3}
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={cancelEditingPost}
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

export default Profile;