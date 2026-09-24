# TODO: Implement state data fetching from DB
VALID_STATES = ["florida", "indiana", "georgia"]


class StateService:
    def is_valid_state(self, slug: str) -> bool:
        return slug in VALID_STATES
