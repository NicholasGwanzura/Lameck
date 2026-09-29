import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'
import { hasAdminSession } from '../../../lib/admin-auth'
import products from '../../../data/products.json'
export async function POST() {
  if (!(await hasAdminSession())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 })
  const db = getDb(); if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })
  await db.query(`CREATE TABLE IF NOT EXISTS products (id text PRIMARY KEY, slug text UNIQUE NOT NULL, name text NOT NULL, brand text, category text NOT NULL, price numeric NOT NULL, currency text NOT NULL DEFAULT 'USD', inventory integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now()); CREATE TABLE IF NOT EXISTS orders (id text PRIMARY KEY, status text NOT NULL, currency text NOT NULL DEFAULT 'USD', total numeric NOT NULL, customer jsonb NOT NULL DEFAULT '{}'::jsonb, items jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`)
  for (const p of products) await db.query(`INSERT INTO products (id,slug,name,brand,category,price,currency,inventory,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET inventory=EXCLUDED.inventory, price=EXCLUDED.price, status=EXCLUDED.status`, [p.id,p.slug,p.name,p.brand,p.category,p.price,'USD',p.inventory,p.status])
  await db.query(`UPDATE products SET status='archived' WHERE id = ANY($1::text[])`, [['prod_aga_elise90', 'prod_haven_chair', 'prod_smeg_fridge', 'prod_bok_table']])
  return NextResponse.json({ ok: true, message: 'South Grant database schema is ready.' })
}
