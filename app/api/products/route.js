import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'
import { hasAdminSession } from '../../../lib/admin-auth'
import fs from 'node:fs/promises'
import path from 'node:path'
const fallback = path.join(process.cwd(), 'data/products.json')
export async function GET(request) {
  const { searchParams } = new URL(request.url); const q = (searchParams.get('q') || '').toLowerCase(); const category = searchParams.get('category'); const db = getDb()
  if (db) { const result = await db.query(`SELECT id,slug,name,brand,category,price::float, currency,inventory,status FROM products WHERE status='active' AND ($1='' OR category=$1) AND ($2='' OR lower(name||' '||coalesce(brand,'')) LIKE '%'||$2||'%') ORDER BY created_at DESC`, [category || '', q]); return NextResponse.json({ products: result.rows, currency: 'USD' }) }
  const products = JSON.parse(await fs.readFile(fallback, 'utf8')).filter((p) => (p.status || 'active') === 'active' && (!category || p.category === category) && (!q || `${p.name} ${p.brand}`.toLowerCase().includes(q))); return NextResponse.json({ products, currency: 'USD' })
}
export async function POST(request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 })
  const p = await request.json(); const db = getDb(); if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 }); const id = p.id || `prod_${Date.now()}`; const result = await db.query(`INSERT INTO products (id,slug,name,brand,category,price,currency,inventory,status) VALUES ($1,$2,$3,$4,$5,$6,'USD',$7,'active') RETURNING *`, [id,p.slug,p.name,p.brand || '',p.category,p.price,p.inventory || 0]); return NextResponse.json(result.rows[0], { status: 201 })
}

export async function PATCH(request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 })

  let input
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: 'Send a valid product update.' }, { status: 400 })
  }

  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.id !== 'string' || !input.id.trim()) {
    return NextResponse.json({ error: 'A product ID is required.' }, { status: 400 })
  }
  if (!Number.isSafeInteger(input.inventory) || input.inventory < 0) {
    return NextResponse.json({ error: 'Inventory must be a non-negative whole number.' }, { status: 400 })
  }

  const db = getDb()
  if (db) {
    const result = await db.query('UPDATE products SET inventory=$1 WHERE id=$2 RETURNING id,inventory', [input.inventory, input.id])
    if (!result.rowCount) return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
    return NextResponse.json({ product: result.rows[0] })
  }

  const products = JSON.parse(await fs.readFile(fallback, 'utf8'))
  const product = products.find((item) => item.id === input.id)
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
  product.inventory = input.inventory
  await fs.writeFile(fallback, JSON.stringify(products, null, 2))
  return NextResponse.json({ product })
}
