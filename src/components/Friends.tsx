import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { UserX } from 'lucide-react';

interface Friend {
  id: string;
  status: string;
  profiles: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  };
}

function Friends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchFriends();
    }
  }, [user]);

  const fetchFriends = async () => {
    try {
      // Fetch friends where the user is either the sender or receiver
      const { data, error } = await supabase
        .from('friends')
        .select(`
          id,
          status,
          profiles!friends_receiver_id_fkey (
            id,
            username,
            full_name,
            avatar_url,
            bio
          )
        `)
        .eq('status', 'accepted')
        .eq('sender_id', user?.id);

      const { data: receiverFriends, error: receiverError } = await supabase
        .from('friends')
        .select(`
          id,
          status,
          profiles!friends_sender_id_fkey (
            id,
            username,
            full_name,
            avatar_url,
            bio
          )
        `)
        .eq('status', 'accepted')
        .eq('receiver_id', user?.id);

      if (error || receiverError) throw error || receiverError;

      const allFriends = [
        ...(data || []),
        ...(receiverFriends || []),
      ];

      setFriends(allFriends);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch friends');
    } finally {
      setLoading(false);
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', friendId);

      if (error) throw error;
      fetchFriends();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove friend');
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
    <div className="max-w-2xl mx-auto mt-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">My Friends</h1>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 text-red-500 dark:text-red-400 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {friends.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">You haven't added any friends yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {friends.map((friend) => (
            <div
              key={friend.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex items-center justify-between"
            >
              <Link
                to={`/profile/${friend.profiles.id}`}
                className="flex items-center space-x-4"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                  {friend.profiles.avatar_url ? (
                    <img
                      src={friend.profiles.avatar_url}
                      alt={friend.profiles.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-2xl">
                      {friend.profiles.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {friend.profiles.full_name || friend.profiles.username}
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400">@{friend.profiles.username}</p>
                  {friend.profiles.bio && (
                    <p className="text-gray-600 dark:text-gray-300 text-sm mt-1 line-clamp-2">
                      {friend.profiles.bio}
                    </p>
                  )}
                </div>
              </Link>
              <button
                onClick={() => removeFriend(friend.id)}
                className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                title="Remove friend"
              >
                <UserX className="h-6 w-6" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Friends