ALTER TABLE messages
ADD COLUMN IF NOT EXISTS feedback VARCHAR(4) DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_feedback_check'
  ) THEN
    ALTER TABLE messages
    ADD CONSTRAINT messages_feedback_check
    CHECK (feedback IN ('up', 'down'));
  END IF;
END $$;
