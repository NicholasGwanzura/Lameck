'use client'

import { useEffect, useState } from 'react'

const navItems = [
  ['products', 'Products & inventory'],
  ['orders', 'Orders'],
]

export default function AdminDashboard() {
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [tab, setTab] = useState('products')
  const [loading, setLoading] = useState(true)
  const [inventoryDrafts, setInventoryDrafts] = useState({})
  const [orderStatusDrafts, setOrderStatusDrafts] = useState({})
  const [savingProductId, setSavingProductId] = useState(null)
  const [savingOrderId, setSavingOrderId] = useState(null)
  const [actionMessage, setActionMessage] = useState('')

  useEffect(() => {
    Promise.all([fetch('/api/products'), fetch('/api/orders')])
      .then(async (responses) => {
        if (responses.some((response) => response.status === 401)) {
          window.location.assign('/admin/login')
          return null
        }
        if (responses.some((response) => !response.ok)) throw new Error('Unable to load store data.')
        return Promise.all(responses.map((response) => response.json()))
      })
      .then((data) => {
        if (!data) return
        const [productData, orderData] = data
        setProducts(productData.products || [])
        setOrders(orderData.orders || [])
      })
      .catch(() => setActionMessage('Unable to load store data. Refresh the page to try again.'))
      .finally(() => setLoading(false))
  }, [])

  async function saveInventory(product) {
    const rawInventory = inventoryDrafts[product.id] ?? String(product.inventory)
    if (!/^\d+$/.test(String(rawInventory)) || !Number.isSafeInteger(Number(rawInventory))) {
      setActionMessage('Enter a non-negative whole number for inventory.')
      return
    }

    setSavingProductId(product.id)
    setActionMessage('')
    try {
      const response = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id, inventory: Number(rawInventory) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to update inventory.')
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, inventory: result.product.inventory } : item))
      setInventoryDrafts((current) => {
        const next = { ...current }
        delete next[product.id]
        return next
      })
      setActionMessage(`Inventory saved for ${product.name}.`)
    } catch (error) {
      setActionMessage(error.message || 'Unable to update inventory.')
    } finally {
      setSavingProductId(null)
    }
  }

  async function saveOrderStatus(order) {
    const status = orderStatusDrafts[order.id] ?? order.status
    setSavingOrderId(order.id)
    setActionMessage('')
    try {
      const response = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to update order status.')
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: result.order.status } : item))
      setOrderStatusDrafts((current) => {
        const next = { ...current }
        delete next[order.id]
        return next
      })
      setActionMessage(`Order ${order.id} updated.`)
    } catch (error) {
      setActionMessage(error.message || 'Unable to update order status.')
    } finally {
      setSavingOrderId(null)
    }
  }

  function logout() {
    fetch('/api/admin/session', { method: 'DELETE' }).finally(() => window.location.assign('/admin/login'))
  }

  const activeLabel = tab === 'products' ? 'Products & inventory' : 'Orders'

  return <main className="admin-shell">
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <a className="admin-sidebar-brand" href="/" aria-label="South Grant storefront"><img src="/southgrant-logo.png" alt="South Grant" /></a>
      <div className="admin-sidebar-title"><span>Store control</span><strong>South Grant</strong></div>
      <nav className="admin-sidebar-nav" aria-label="Store control sections">
        {navItems.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><span className={`admin-nav-icon admin-nav-icon-${id}`} aria-hidden="true">{id === 'products' ? '▦' : '◷'}</span><span>{label}</span><small>{id === 'products' ? products.length : orders.length}</small></button>)}
      </nav>
      <div className="admin-sidebar-footer"><a href="/" className="admin-sidebar-link">View storefront <span aria-hidden="true">↗</span></a><button type="button" className="admin-sidebar-link" onClick={logout}>Sign out <span aria-hidden="true">↗</span></button></div>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><p className="kicker">South Grant / Admin</p><h1>{activeLabel}</h1><p className="admin-subtitle">Manage the catalog, stock levels, and customer orders.</p></div><div className="admin-topbar-actions"><span className="admin-status"><i /> Admin session active</span><a className="admin-mobile-storefront" href="/">Storefront&nbsp;↗</a></div></header>
      <div className="admin-metrics"><div><span>Catalog</span><strong>{loading ? '—' : products.length}</strong><small>Products listed</small></div><div><span>Orders</span><strong>{loading ? '—' : orders.length}</strong><small>All order statuses</small></div><div><span>Currency</span><strong>USD</strong><small>15.5% VAT included</small></div></div>
      {actionMessage && <p className="form-status" role="status" aria-live="polite">{actionMessage}</p>}
      {tab === 'products' ? <section className="admin-panel" aria-labelledby="products-heading"><div className="admin-panel-heading"><div><p className="kicker">Live catalog</p><h2 id="products-heading">Products &amp; inventory</h2></div><span className="admin-panel-count">{products.length} items</span></div><div className="admin-table-wrap"><div className="admin-row admin-head"><span>Product</span><span>Category</span><span>Price</span><span>Inventory</span><span>Status</span></div>{products.map((product) => <div className="admin-row" key={product.id}><span><strong>{product.name}</strong><small>{product.brand}</small></span><span>{product.category}</span><span>${Number(product.price).toLocaleString()}</span><span style={{ display: 'grid', gap: '.4rem', justifyItems: 'start' }}><input aria-label={`Inventory for ${product.name}`} type="number" min="0" step="1" value={inventoryDrafts[product.id] ?? product.inventory} onChange={(event) => setInventoryDrafts((current) => ({ ...current, [product.id]: event.target.value }))} style={{ width: '6rem', padding: '.4rem' }} /><button className="button button-dark" type="button" onClick={() => saveInventory(product)} disabled={savingProductId === product.id} style={{ padding: '.45rem .65rem', fontSize: '.58rem', whiteSpace: 'nowrap' }}>{savingProductId === product.id ? 'Saving…' : 'Save stock'}</button></span><span className="status-pill">{product.status}</span></div>)}</div></section> : <section className="admin-panel" aria-labelledby="orders-heading"><div className="admin-panel-heading"><div><p className="kicker">Customer activity</p><h2 id="orders-heading">Orders</h2></div><span className="admin-panel-count">{orders.length} orders</span></div><div className="admin-table-wrap"><div className="admin-row admin-head"><span>Order</span><span>Customer</span><span>Total</span><span>Status</span></div>{orders.length ? orders.map((order) => <div className="admin-row admin-order-row" key={order.id}><span><strong>{order.id}</strong><small>{new Date(order.createdAt).toLocaleDateString()}</small></span><span>{order.customer?.email || 'Guest'}</span><span>${Number(order.total).toLocaleString()}</span><span style={{ display: 'grid', gap: '.4rem', justifyItems: 'start' }}><select aria-label={`Status for order ${order.id}`} value={orderStatusDrafts[order.id] ?? order.status} onChange={(event) => setOrderStatusDrafts((current) => ({ ...current, [order.id]: event.target.value }))}><option value="pending_payment">Pending payment</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="completed">Completed</option></select><button className="button button-dark" type="button" onClick={() => saveOrderStatus(order)} disabled={savingOrderId === order.id} style={{ padding: '.45rem .65rem', fontSize: '.58rem', whiteSpace: 'nowrap' }}>{savingOrderId === order.id ? 'Saving…' : 'Update status'}</button></span></div>) : <p className="empty-state">No orders yet.</p>}</div></section>}
    </section>
  </main>
}
