from abc import ABC, abstractmethod
from models import Candidate


class BaseScraper(ABC):
    @abstractmethod
    def search(self, name: str) -> list[Candidate]:
        """상품명으로 검색하여 Candidate 리스트 반환."""
        ...
