import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv(Path(__file__).parent / ".env", override=True)


def _sqlite_dir(url: str) -> Path | None:
    """The folder holding the SQLite file this URL points at (None for other URLs)."""
    prefix = "sqlite+aiosqlite:///"
    if not url.startswith(prefix):
        return None
    raw = url[len(prefix):]
    return Path(raw).expanduser().resolve().parent if raw else None


# `P6_DB_PATH` is set by the packaged desktop build (desktop/app_launcher.py) and is the
# one name dotenv cannot shadow, so a `.env` next to the code can never pull the database
# out of the user's data folder. Without it the dev setup is unchanged (backend/db, or
# whatever DATABASE_URL says).
_p6_db_path = os.getenv("P6_DB_PATH", "").strip()
if _p6_db_path:
    DB_PATH = Path(_p6_db_path).expanduser().resolve()
    DB_DIR = DB_PATH.parent
    DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH.as_posix()}"
else:
    DB_DIR = Path(__file__).parent / "db"
    DB_PATH = DB_DIR / "pyworkflow.db"
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{DB_PATH}")
    DB_DIR = _sqlite_dir(DATABASE_URL) or DB_DIR

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    DB_DIR.mkdir(exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db
