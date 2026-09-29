import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getDb } from '../../../lib/db'
import { hasAdminSession } from '../../../lib/admin-auth'
import config from '../../../data/store-config.json'

const productsFile = path.join(process.cwd(), 'data/products.json')
const ordersFile = path.join(process.cwd(), 'data/orders.json')

function quantityFor(item) {
  const quantity = Number(item.qty)
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Each item quantity must be a positive whole number.')
  return quantity
}

function createOrder(lines, customer) {
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0)
  const delivery = Number(config.delivery[customer?.city] ?? config.delivery['Other Zimbabwe'])
  const vat = Number(((subtotal + delivery) * config.vatRate).toFixed(2))
  return {
    id: `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'pending_payment',
    currency: 'USD',
    items: lines,
    subtotal,
    delivery,
    vat,
    vatRate: config.vatRate,
    total: subtotal + delivery + vat,
    customer: customer || {},
    createdAt: new Date().toISOString(),
  }
}

export async function GET() {
  if (!(await hasAdminSession())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 })
  const db = getDb()
  if (db) {
    const result = await db.query('SELECT id,status,currency,total,customer,items,created_at AS "createdAt" FROM orders ORDER BY created_at DESC')
    return NextResponse.json({ orders: result.rows })
  }
  return NextResponse.json({ orders: JSON.parse(await fs.readFile(ordersFile, 'utf8')) })
}

export async function PATCH(request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 })

  let input
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: 'Send a valid order update.' }, { status: 400 })
  }

  const allowedStatuses = new Set(['pending_payment', 'processing', 'shipped', 'completed'])
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.id !== 'string' || !input.id.trim()) {
    return NextResponse.json({ error: 'An order ID is required.' }, { status: 400 })
  }
  if (!allowedStatuses.has(input.status)) {
    return NextResponse.json({ error: 'Choose a supported order status.' }, { status: 400 })
  }

  const db = getDb()
  if (db) {
    const result = await db.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING id,status', [input.status, input.id])
    if (!result.rowCount) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    return NextResponse.json({ order: result.rows[0] })
  }

  const orders = JSON.parse(await fs.readFile(ordersFile, 'utf8'))
  const order = orders.find((item) => item.id === input.id)
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  order.status = input.status
  await fs.writeFile(ordersFile, JSON.stringify(orders, null, 2))
  return NextResponse.json({ order })
}

export async function POST(request) {
  try {
    const input = await request.json()
    if (!Array.isArray(input.items) || !input.items.length) return NextResponse.json({ error: 'Order requires items.' }, { status: 400 })

    const db = getDb()
    if (db) {
      const client = await db.connect()
      try {
        await client.query('BEGIN')
        const lines = []
        for (const item of input.items) {
          const quantity = quantityFor(item)
          const result = await client.query('SELECT id,slug,name,price::float AS price,inventory FROM products WHERE id=$1 OR slug=$1 OR slug=$2 LIMIT 1 FOR UPDATE', [item.productId || '', item.slug || ''])
          const product = result.rows[0]
          if (!product || product.inventory < quantity) throw new Error(`Unavailable product: ${item.productId || item.slug}`)
          await client.query('UPDATE products SET inventory=inventory-$1 WHERE id=$2', [quantity, product.id])
          lines.push({ productId: product.id, name: product.name, qty: quantity, unitPrice: product.price, amount: product.price * quantity })
        }
        const order = createOrder(lines, input.customer)
        await client.query('INSERT INTO orders (id,status,currency,total,customer,items) VALUES ($1,$2,$3,$4,$5,$6)', [order.id, order.status, order.currency, order.total, JSON.stringify(order.customer), JSON.stringify(order.items)])
        await client.query('COMMIT')
        return NextResponse.json(order, { status: 201 })
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    const products = JSON.parse(await fs.readFile(productsFile, 'utf8'))
    const lines = []
    for (const item of input.items) {
      const quantity = quantityFor(item)
      const product = products.find((candidate) => candidate.id === item.productId || candidate.slug === item.productId || candidate.slug === item.slug)
      if (!product || product.inventory < quantity) throw new Error(`Unavailable product: ${item.productId || item.slug}`)
      product.inventory -= quantity
      lines.push({ productId: product.id, name: product.name, qty: quantity, unitPrice: product.price, amount: product.price * quantity })
    }
    const order = createOrder(lines, input.customer)
    const orders = JSON.parse(await fs.readFile(ordersFile, 'utf8'))
    await fs.writeFile(productsFile, JSON.stringify(products, null, 2))
    orders.push(order)
    await fs.writeFile(ordersFile, JSON.stringify(orders, null, 2))
    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    const status = error.message?.startsWith('Unavailable') ? 409 : error.message?.includes('quantity') ? 400 : 500
    return NextResponse.json({ error: error.message || 'Unable to create order.' }, { status })
  }
}
