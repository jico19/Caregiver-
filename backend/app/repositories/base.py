# Base repository pattern for Supabase data access
class BaseRepository:
    def __init__(self, supabase_client):
        self.client = supabase_client
