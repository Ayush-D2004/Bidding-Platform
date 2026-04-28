"""
Standalone seed script — useful if you want to re-seed the DB manually.
The database.py init_db() already seeds on startup, so this is optional.

Usage:
    python seed_data.py
"""
import asyncio
import aiosqlite
from database import DB_PATH, SCHEMA, SEED_PLAYERS, SEED_TEAMS


async def main():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.executescript(SCHEMA)

        # Clear existing data (fresh seed)
        await db.execute("DELETE FROM roster_assignments")
        await db.execute("DELETE FROM auction_events")
        await db.execute("DELETE FROM auctions")
        await db.execute("DELETE FROM players")
        await db.execute("DELETE FROM teams")
        await db.commit()

        for p in SEED_PLAYERS:
            await db.execute(
                "INSERT INTO players (id, name, skill_type, bat_strength, bowl_strength, base_price) VALUES (?,?,?,?,?,?)",
                (p["id"], p["name"], p["skill_type"], p["bat_strength"], p["bowl_strength"], p["base_price"]),
            )

        for t in SEED_TEAMS:
            await db.execute(
                "INSERT INTO teams (id, name, budget) VALUES (?,?,?)",
                (t["id"], t["name"], t["budget"]),
            )

        await db.commit()

    print("✅  Database seeded successfully!")
    print(f"    Players: {len(SEED_PLAYERS)}")
    print(f"    Teams:   {len(SEED_TEAMS)}")


if __name__ == "__main__":
    asyncio.run(main())
