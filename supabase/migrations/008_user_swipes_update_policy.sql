-- Allow users to update their own swipes (needed for upsert / undo feature)
CREATE POLICY "Users can update own swipes"
  ON user_swipes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
