// Legacy types (kept until Phase 5 cleanup)
export interface Room {
  id: string;
  code: string;
  created_by: string;
  status: 'waiting' | 'active' | 'completed';
  movie_page: number;
  created_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface Swipe {
  id: string;
  room_id: string;
  user_id: string;
  tmdb_movie_id: number;
  liked: boolean;
  created_at: string;
}

export interface Match {
  room_id: string;
  tmdb_movie_id: number;
  matched_at: string;
}

// New types (connection model)
export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  phone_verified: boolean;
  preferred_genres: number[];
  preferred_languages: string[];
  created_at: string;
  updated_at: string;
}

export interface UserSwipe {
  id: string;
  user_id: string;
  tmdb_movie_id: number;
  liked: boolean;
  created_at: string;
}

export interface Connection {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  updated_at: string;
  other_user_id: string;
  other_username: string;
  other_display_name: string | null;
  other_avatar_url: string | null;
}

export interface ConnectionMatch {
  id: string;
  connection_id: string;
  tmdb_movie_id: number;
  matched_at: string;
}
