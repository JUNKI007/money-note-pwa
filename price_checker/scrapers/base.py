from abc import ABC, abstractmethod
from price_checker.models import Candidate


class BaseScraper(ABC):
    """추후 API 방식으로 교체할 수 있도록 인터페이스 분리."""

    @abstractmethod
    async def search(self, name: str) -> list[Candidate]:
        """상품명으로 검색하여 Candidate 리스트 반환."""
        ...

    @abstractmethod
    async def close(self) -> None:
        """브라우저 등 리소스 해제."""
        ...
