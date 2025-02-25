import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Heart, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author_id: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
  likes: { user_id: string }[];
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPost();
    fetchComments();
  }, [id]);

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id (username, avatar_url),
          likes (user_id)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setPost(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch post');
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('post_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comments');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    try {
      const { error } = await supabase.from('comments').insert([
        {
          post_id: id,
          user_id: user.id,
          content: newComment.trim(),
        },
      ]);

      if (error) throw error;

      setNewComment('');
      fetchComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .match({ id: commentId, user_id: user.id });

      if (error) throw error;
      fetchComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
    }
  };

  const toggleLike = async () => {
    if (!user || !post) return;

    try {
      const existingLike = post.likes.some(like => like.user_id === user.id);

      if (existingLike) {
        await supabase
          .from('likes')
          .delete()
          .match({ post_id: post.id, user_id: user.id });
      } else {
        await supabase
          .from('likes')
          .insert([{ post_id: post.id, user_id: user.id }]);
      }

      fetchPost();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle like');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-4">
        <div className="bg-red-50 text-red-500 p-4 rounded-lg">
          Post not found
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8">
      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <Link
              to={`/profile/${post.author_id}`}
              className="flex items-center space-x-3"
            >
              <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden">
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
                <h3 className="font-semibold text-gray-900">
                  {post.profiles.username}
                </h3>
                <p className="text-sm text-gray-500">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </Link>
          </div>

          <p className="text-gray-800 mb-4 whitespace-pre-wrap">{post.content}</p>

          {post.image_url && (
            <div className="mb-4 rounded-lg overflow-hidden">
              <img
                src={post.image_url}
                alt="Post content"
                className="w-full h-auto"
              />
            </div>
          )}

          <button
            onClick={toggleLike}
            className={`flex items-center space-x-2 ${
              user && post.likes.some(like => like.user_id === user.id)
                ? 'text-red-500'
                : 'text-gray-500 hover:text-red-500'
            }`}
          >
            <Heart className="h-5 w-5" />
            <span>{post.likes.length} likes</span>
          </button>
        </div>

        <div className="border-t border-gray-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Comments ({comments.length})
          </h3>

          {user && (
            <form onSubmit={handleAddComment} className="mb-6">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={2}
                required
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Comment
                </button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex space-x-3">
                <Link
                  to={`/profile/${comment.user_id}`}
                  className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full overflow-hidden"
                >
                  {comment.profiles.avatar_url ? (
                    <img
                      src={comment.profiles.avatar_url}
                      alt={comment.profiles.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white">
                      {comment.profiles.username[0].toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="flex-grow">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          to={`/profile/${comment.user_id}`}
                          className="font-semibold text-gray-900 hover:underline"
                        >
                          {comment.profiles.username}
                        </Link>
                        <p className="text-gray-800 mt-1">{comment.content}</p>
                      </div>
                      {user && comment.user_id === user.id && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PostDetail;