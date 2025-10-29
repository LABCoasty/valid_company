from __future__ import annotations

from pathlib import Path
from typing import Optional

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression


class ScamDetector:
    """Simple ML model to score job descriptions for scam risk."""

    def __init__(self) -> None:
        self._vectorizer: Optional[TfidfVectorizer] = None
        self._model: Optional[LogisticRegression] = None

    def load(self, model_path: Path, vocab_path: Path) -> None:
        self._model = joblib.load(model_path)
        self._vectorizer = joblib.load(vocab_path)

    def predict_probability(self, text: str) -> float:
        if not self._model or not self._vectorizer:
            raise RuntimeError('ScamDetector must be loaded before predicting')
        features = self._vectorizer.transform([text])
        prob = self._model.predict_proba(features)
        return float(prob[0][1])

    def fallback_score(self, text: str) -> float:
        """Fallback heuristic when no ML model is provided."""
        suspicious_keywords = ['wire transfer', 'crypto', 'bitcoin', 'training fee']
        if not text:
            return 0.2
        text_lower = text.lower()
        score = sum(keyword in text_lower for keyword in suspicious_keywords) / len(suspicious_keywords)
        return float(np.clip(score, 0.0, 1.0))
