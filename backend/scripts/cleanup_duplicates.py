import os
import sys
from collections import defaultdict

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import supabase

def run_cleanup():
    print("Fetching all products...")
    response = supabase.table("products").select("*").execute()
    products = response.data or []

    # Group by normalized name
    groups = defaultdict(list)
    for p in products:
        norm = p["name"].strip().lower()
        groups[norm].append(p)

    duplicates_found = 0
    for norm_name, items in groups.items():
        if len(items) <= 1:
            continue
        
        duplicates_found += 1
        print(f"\nFound {len(items)} duplicates for '{norm_name}'")
        
        # Sort items: prefer ones with barcode, then highest stock, then oldest created_at
        items.sort(key=lambda x: (
            bool(x.get("barcode")),
            x.get("stock", 0),
            x.get("created_at")
        ), reverse=True)

        master = items[0]
        duplicates = items[1:]
        duplicate_ids = [d["id"] for d in duplicates]
        
        print(f"  Master ID: {master['id']} ({master['name']})")
        print(f"  Duplicate IDs to merge: {duplicate_ids}")

        # Combine stock
        total_duplicate_stock = sum(d.get("stock", 0) for d in duplicates)
        if total_duplicate_stock > 0:
            new_stock = master.get("stock", 0) + total_duplicate_stock
            print(f"  Updating master stock from {master.get('stock', 0)} to {new_stock}")
            supabase.table("products").update({"stock": new_stock}).eq("id", master["id"]).execute()

        # Update purchases
        purchases = supabase.table("purchases").select("*").in_("product_id", duplicate_ids).execute().data or []
        for p in purchases:
            print(f"  Updating purchase {p['id']} to point to master product")
            supabase.table("purchases").update({"product_id": master["id"]}).eq("id", p["id"]).execute()

        # Update sales items
        # Sales store items in JSON
        all_sales = supabase.table("sales").select("*").execute().data or []
        for s in all_sales:
            modified = False
            new_items = []
            for item in s.get("items", []):
                if item.get("product_id") in duplicate_ids:
                    item["product_id"] = master["id"]
                    modified = True
                new_items.append(item)
            if modified:
                print(f"  Updating sale {s['id']} to point to master product")
                supabase.table("sales").update({"items": new_items}).eq("id", s["id"]).execute()

        # Delete duplicates
        for d in duplicates:
            print(f"  Deleting duplicate {d['id']}")
            supabase.table("products").delete().eq("id", d["id"]).execute()

    if duplicates_found == 0:
        print("\nNo duplicates found!")
    else:
        print("\nCleanup complete.")

if __name__ == "__main__":
    run_cleanup()
