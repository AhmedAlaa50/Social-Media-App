/*
  # Add friends and sharing features

  1. New Tables
    - `friends`
      - `id` (uuid, primary key)
      - `sender_id` (uuid, references profiles)
      - `receiver_id` (uuid, references profiles)
      - `status` (text: 'pending' or 'accepted')
      - `created_at` (timestamp)
    
    - `shared_posts`
      - `id` (uuid, primary key)
      - `post_id` (uuid, references posts)
      - `user_id` (uuid, references profiles)
      - `created_at` (timestamp)

  2. Changes
    - Add `visibility` column to `posts` table

  3. Security
    - Enable RLS on new tables
    - Add policies for friends and shared posts
*/

-- Add visibility column to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public';

-- Create friends table
CREATE TABLE IF NOT EXISTS friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text CHECK (status IN ('pending', 'accepted')) NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- Create shared_posts table
CREATE TABLE IF NOT EXISTS shared_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_posts ENABLE ROW LEVEL SECURITY;

-- Friends policies
CREATE POLICY "Users can view their own friend requests"
  ON friends FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send friend requests"
  ON friends FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can accept/reject friend requests"
  ON friends FOR UPDATE
  USING (auth.uid() = receiver_id);

CREATE POLICY "Users can remove friends"
  ON friends FOR DELETE
  USING (auth.uid() IN (sender_id, receiver_id));

-- Shared posts policies
CREATE POLICY "Users can view shared posts"
  ON shared_posts FOR SELECT
  USING (true);

CREATE POLICY "Users can share posts"
  ON shared_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their shares"
  ON shared_posts FOR DELETE
  USING (auth.uid() = user_id);

-- Update posts policies to handle visibility
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
CREATE POLICY "Posts are viewable based on visibility"
  ON posts FOR SELECT
  USING (
    visibility = 'public' OR
    auth.uid() = author_id OR
    (
      visibility = 'friends' AND
      EXISTS (
        SELECT 1 FROM friends
        WHERE (
          (sender_id = auth.uid() AND receiver_id = author_id) OR
          (receiver_id = auth.uid() AND sender_id = author_id)
        )
        AND status = 'accepted'
      )
    )
  );