import os
import sys

# Add backend directory to sys.path to import from app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import supabase

def merge_duplicates():
    products = supabase.table("products").select("*").execute().data or []
    
    from collections import defaultdict
    groups = defaultdict(list)
    for p in products:
        groups[p["name"].strip().lower()].append(p)
        
    merged_count = 0
    for name, group in groups.items():
        if len(group) > 1:
            print(f"Merging duplicates for '{name}'...")
            
            primary = None
            for p in group:
                if p.get("barcode"):
                    primary = p
                    break
            if not primary:
                primary = group[0]
                
            duplicates = [p for p in group if p["id"] != primary["id"]]
            total_extra_stock = sum(p["stock"] for p in duplicates)
            
            if total_extra_stock > 0:
                new_stock = primary["stock"] + total_extra_stock
                supabase.table("products").update({"stock": new_stock}).eq("id", primary["id"]).execute()
                print(f"  -> Updated stock for primary {primary['id']} to {new_stock}")
                
            for dup in duplicates:
                dup_id = dup["id"]
                # Update purchases
                purchases = supabase.table("purchases").select("id").eq("product_id", dup_id).execute().data or []
                for pur in purchases:
                    supabase.table("purchases").update({"product_id": primary["id"]}).eq("id", pur["id"]).execute()
                print(f"  -> Reassigned {len(purchases)} purchases from {dup_id} to {primary['id']}")
                
                # Delete duplicate
                supabase.table("products").delete().eq("id", dup_id).execute()
                print(f"  -> Deleted duplicate {dup_id}")
                merged_count += 1
                
    print(f"Done. Merged {merged_count} duplicate product(s).")

if __name__ == "__main__":
    merge_duplicates()
