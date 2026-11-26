CREATE TABLE emotion_counts (
  emotion TEXT PRIMARY KEY NOT NULL,
  total INTEGER NOT NULL CHECK (total > 0)
);
