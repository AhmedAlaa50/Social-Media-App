import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Check, X, UserPlus } from 'lucide-react';

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

function FriendRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchFriendRequests();
    }
  }, [user]);

  const fetchFriendRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          *,
          profiles:sender_id (username, avatar_url)
        `)
        .eq('receiver_id', user?.id)
        .eq('status', 'pending');

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch friend requests');
    }
  };

  const handleRequest = async (requestId: string, accept: boolean) => {
    try {
      if (accept) {
        const { error } = await supabase
          .from('friends')
          .update({ status: 'accepted' })
          .match({ id: requestId });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('friends')
          .delete()
          .match({ id: requestId });

        if (error) throw error;
      }

      fetchFriendRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to handle friend request');
    }
  };

  if (!user) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Friend Requests
      </h2>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 text-red-500 dark:text-red-400 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No pending friend requests</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <Link
                to={`/profile/${request.sender_id}`}
                className="flex items-center space-x-3"
              >
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  {request.profiles.avatar_url ? (
                    <img
                      src={request.profiles.avatar_url}
                      alt={request.profiles.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-xl">
                      {request.profiles.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    {request.profiles.username}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Wants to be your friend
                  </p>
                </div>
              </Link>

              <div className="flex space-x-2">
                <button
                  onClick={() => handleRequest(request.id, true)}
                  className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full"
                >
                  <Check className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleRequest(request.id, false)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FriendRequests;