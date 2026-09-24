# TODO: Implement Supabase Auth integration
class AuthService:
    async def login(self, email: str, password: str):
        raise NotImplementedError

    async def register(self, email: str, password: str, role: str):
        raise NotImplementedError
