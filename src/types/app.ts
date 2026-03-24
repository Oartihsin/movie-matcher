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
