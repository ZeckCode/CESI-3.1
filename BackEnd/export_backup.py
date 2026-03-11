"""
Export SQLite database to JSON backup file.
No BOM, plain JSON format.
"""
import sqlite3
import json
from datetime import datetime

DB_PATH = "db.sqlite3"
OUTPUT_PATH = "db_backup.json"

def get_table_data(cursor, table_name):
    """Get all rows from a table as list of dicts."""
    cursor.execute(f"SELECT * FROM {table_name}")
    columns = [desc[0] for desc in cursor.description]
    rows = []
    for row in cursor.fetchall():
        row_dict = {}
        for i, val in enumerate(row):
            # Handle bytes (like images) - skip them or encode as base64
            if isinstance(val, bytes):
                row_dict[columns[i]] = None  # Skip binary data
            else:
                row_dict[columns[i]] = val
        rows.append(row_dict)
    return rows

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get all table names (skip internal Django/SQLite tables)
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = [t[0] for t in cursor.fetchall()]
    
    backup = {
        "exported_at": datetime.now().isoformat(),
        "tables": {}
    }
    
    for table in sorted(tables):
        try:
            data = get_table_data(cursor, table)
            backup["tables"][table] = data
            print(f"  {table}: {len(data)} rows")
        except Exception as e:
            print(f"  {table}: ERROR - {e}")
    
    conn.close()
    
    # Write JSON without BOM, with proper formatting
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(backup, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\nBackup saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
