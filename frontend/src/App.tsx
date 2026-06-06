import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:5001/api/v1';

interface Product {
  id: string;
  sku: string;
  nombre: string;
  precio: number | string;
  inventarios: Array<{
    stockDisponible: number;
    stockReservado: number;
    ubicacion: { nombre: string; tipo: string };
  }>;
}

interface Order {
  id: string;
  canal: string;
  estado: string;
  fechaCreacion: string;
  total: number | string;
  lineas: Array<{
    cantidad: number;
    precioUnitario: number | string;
    producto: { nombre: string; sku: string };
  }>;
}

interface Reservation {
  id: string;
  cantidad: number;
  estado: string;
  fechaCreacion: string;
  fechaExpiracion: string;
  producto: { nombre: string; sku: string };
  ubicacion: { nombre: string };
}

interface HistoryLog {
  id: string;
  cantidad: number;
  tipoMovimiento: string;
  fechaHora: string;
  producto: { nombre: string; sku: string };
  ubicacion: { nombre: string };
  usuario: { username: string; rol: string };
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [rol, setRol] = useState<string | null>(localStorage.getItem('rol'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));

  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [activeTab, setActiveTab] = useState<'pos' | 'dashboard' | 'history' | 'reservations' | 'products'>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [history, setHistory] = useState<HistoryLog[]>([]);

  // POS State
  const [cart, setCart] = useState<Array<{ product: Product; qty: number }>>([]);
  const [posLocation, setPosLocation] = useState('Tienda Valdivia');

  // Simulation Web Reserve State
  const [simProduct, setSimProduct] = useState('');
  const [simQty, setSimQty] = useState(1);
  const [simLocation, setSimLocation] = useState('Bodega E-commerce');

  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // RF-003: Product CRUD state
  const [newSku, setNewSku] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newPrecio, setNewPrecio] = useState('');
  const [newInitialStockValdivia, setNewInitialStockValdivia] = useState('0');
  const [newInitialStockEcommerce, setNewInitialStockEcommerce] = useState('0');

  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editPrecio, setEditPrecio] = useState('');

  // Add Stock state
  const [stockAddingSku, setStockAddingSku] = useState<string | null>(null);
  const [addStockQty, setAddStockQty] = useState<string>('10');
  const [addStockLocation, setAddStockLocation] = useState<string>('Tienda Valdivia');

  // Auto-connect fallback to mock data if API fails
  const [isUsingMocks, setIsUsingMocks] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchData();
    const interval = setInterval(fetchData, 8000); // refresh lists every 8 seconds
    return () => clearInterval(interval);
  }, [token]);

  // RF-009: Inactivity logout detector (30 minutes)
  useEffect(() => {
    if (!token) return;

    let timeoutId: number;
    const INACTIVITY_TIME = 30 * 60 * 1000; // 30 mins

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
        showNotification('Sesión cerrada automáticamente por inactividad (30 minutos).', 'warning');
      }, INACTIVITY_TIME);
    };

    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [token]);

  const showNotification = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchData = async () => {
    try {
      const currentRole = rol || localStorage.getItem('rol');

      // 1. Catalog of products is accessible by all roles
      const pRes = await fetch(`${API_BASE_URL}/sales/products`);
      if (!pRes.ok) throw new Error();
      const productsData = await pRes.json();
      setProducts(productsData);

      // 2. Fetch orders only for Admin
      if (currentRole === 'Admin') {
        const oRes = await fetch(`${API_BASE_URL}/sales/orders`, {
          headers: getAuthHeaders()
        });
        if (oRes.ok) {
          const ordersData = await oRes.json();
          setOrders(ordersData);
        }
      }

      // 3. Fetch reservations for Admin or ECommerce
      if (currentRole === 'Admin' || currentRole === 'ECommerce') {
        const rRes = await fetch(`${API_BASE_URL}/sales/reservations`, {
          headers: getAuthHeaders()
        });
        if (rRes.ok) {
          const resData = await rRes.json();
          setReservations(resData);
        }
      }

      // 4. Fetch history log only for Admin
      if (currentRole === 'Admin') {
        const hRes = await fetch(`${API_BASE_URL}/sales/history`, {
          headers: getAuthHeaders()
        });
        if (hRes.ok) {
          const histData = await hRes.json();
          setHistory(histData);
        }
      }

      setIsUsingMocks(false);
    } catch (err) {
      console.warn('Backend server unreachable. Loading visual mock data for presentation purposes.');
      setIsUsingMocks(true);
      loadMockData();
    }
  };

  const loadMockData = () => {
    // Seeder products
    const mockProds: Product[] = [
      {
        id: '1',
        sku: 'PES-CA1',
        nombre: 'Caña de Pescar Shakespeare Ugly Stik',
        precio: 59990,
        inventarios: [
          { stockDisponible: 10, stockReservado: 0, ubicacion: { nombre: 'Tienda Valdivia', tipo: 'Tienda' } },
          { stockDisponible: 30, stockReservado: 0, ubicacion: { nombre: 'Bodega E-commerce', tipo: 'Bodega' } }
        ]
      },
      {
        id: '2',
        sku: 'PES-RE1',
        nombre: 'Carrete de Pescar Shimano Sedona',
        precio: 79990,
        inventarios: [
          { stockDisponible: 8, stockReservado: 0, ubicacion: { nombre: 'Tienda Valdivia', tipo: 'Tienda' } },
          { stockDisponible: 25, stockReservado: 0, ubicacion: { nombre: 'Bodega E-commerce', tipo: 'Bodega' } }
        ]
      },
      {
        id: '3',
        sku: 'PES-AN1',
        nombre: 'Anzuelos Mustad Pack x10',
        precio: 4990,
        inventarios: [
          { stockDisponible: 50, stockReservado: 0, ubicacion: { nombre: 'Tienda Valdivia', tipo: 'Tienda' } },
          { stockDisponible: 200, stockReservado: 0, ubicacion: { nombre: 'Bodega E-commerce', tipo: 'Bodega' } }
        ]
      }
    ];

    setProducts(mockProds);
    if (simProduct === '') setSimProduct(mockProds[0].sku);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.mensaje || 'Error al autenticar');
      }

      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('rol', data.rol);
      localStorage.setItem('username', data.username);
      setToken(data.token);
      setRol(data.rol);
      setUsername(data.username);
      showNotification(`Sesión iniciada como ${data.username}`, 'success');
    } catch (err: any) {
      console.warn('Backend login unavailable. Simulating login with local credentials.');
      // Local authentication for demo mock purposes
      if ((loginUser === 'admin' && loginPass === 'admin123') || (loginUser === 'vendedor1' && loginPass === 'vendedor123')) {
        const fakeRole = loginUser === 'admin' ? 'Admin' : 'Vendedor';
        setToken('fake-jwt-token');
        setRol(fakeRole);
        setUsername(loginUser);
        localStorage.setItem('token', 'fake-jwt-token');
        localStorage.setItem('rol', fakeRole);
        localStorage.setItem('username', loginUser);
        showNotification(`Sesión iniciada (Demo Mode) como ${loginUser}`, 'success');
      } else {
        showNotification(err.message || 'Credenciales inválidas.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
    localStorage.removeItem('username');
    setToken(null);
    setRol(null);
    setUsername(null);
    setCart([]);
    showNotification('Sesión cerrada.', 'warning');
  };

  // POS CART ACTIONS
  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.sku === product.sku);
    const storeStock = product.inventarios.find(inv => inv.ubicacion.nombre === posLocation)?.stockDisponible || 0;

    const currentQty = existing ? existing.qty : 0;
    if (currentQty + 1 > storeStock) {
      showNotification(`No hay más stock disponible en ${posLocation} para este producto.`, 'error');
      return;
    }

    if (existing) {
      setCart(cart.map(item => item.product.sku === product.sku ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { product, qty: 1 }]);
    }
  };

  const updateCartQty = (sku: string, value: number) => {
    const product = products.find(p => p.sku === sku);
    if (!product) return;
    const storeStock = product.inventarios.find(inv => inv.ubicacion.nombre === posLocation)?.stockDisponible || 0;

    if (value > storeStock) {
      showNotification(`El stock disponible en ${posLocation} es ${storeStock}.`, 'error');
      return;
    }

    if (value <= 0) {
      setCart(cart.filter(item => item.product.sku !== sku));
    } else {
      setCart(cart.map(item => item.product.sku === sku ? { ...item, qty: value } : item));
    }
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + Number(item.product.precio) * item.qty, 0);
  };

  // --- PROTOCOL BRIDGE: POS CHECKOUT ---
  const handlePOSCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const items = cart.map(i => ({ sku: i.product.sku, cantidad: i.qty }));

      const res = await fetch(`${API_BASE_URL}/sales/checkout`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ items, ubicacion: posLocation })
      });

      const data = await res.json();
      if (res.status === 202) {
        showNotification(
          `[Protocol Bridge ESB] Venta recibida y encolada. ID de Rastreo: ${data.trackingId.slice(0, 8)}...`,
          'success'
        );
        setCart([]);
        setTimeout(fetchData, 1000); // refresh after 1 sec
      } else {
        throw new Error(data.mensaje || 'Error al procesar la venta');
      }
    } catch (err: any) {
      if (isUsingMocks) {
        // Local simulation of POS sale
        simulateLocalSale();
      } else {
        showNotification(err.message || 'Error de conexión con el backend', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const simulateLocalSale = () => {
    // Revert/Deduct local mock stock
    const updatedProducts = products.map(p => {
      const cartItem = cart.find(c => c.product.sku === p.sku);
      if (cartItem) {
        return {
          ...p,
          inventarios: p.inventarios.map(inv => {
            if (inv.ubicacion.nombre === posLocation) {
              return { ...inv, stockDisponible: inv.stockDisponible - cartItem.qty };
            }
            return inv;
          })
        };
      }
      return p;
    });

    // Create a mock order
    const mockOrder: Order = {
      id: crypto.randomUUID(),
      canal: 'POS_Fisico',
      estado: 'Pagada',
      fechaCreacion: new Date().toISOString(),
      total: getCartTotal(),
      lineas: cart.map(i => ({
        cantidad: i.qty,
        precioUnitario: i.product.precio,
        producto: { nombre: i.product.nombre, sku: i.product.sku }
      }))
    };

    // Create history logs
    const newLogs: HistoryLog[] = cart.map(i => ({
      id: crypto.randomUUID(),
      cantidad: i.qty,
      tipoMovimiento: 'Venta',
      fechaHora: new Date().toISOString(),
      producto: { nombre: i.product.nombre, sku: i.product.sku },
      ubicacion: { nombre: posLocation },
      usuario: { username: username || 'vendedor1', rol: rol || 'Vendedor' }
    }));

    setProducts(updatedProducts);
    setOrders([mockOrder, ...orders]);
    setHistory([...newLogs, ...history]);
    setCart([]);
    showNotification('Venta completada (Modo simulación local)', 'success');
  };

  // E-COMMERCE RESERVATION SIMULATION
  const handleReserveWeb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (simQty <= 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/reserve`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ sku: simProduct, cantidad: simQty, ubicacion: simLocation })
      });

      const data = await res.json();
      if (res.status === 201) {
        showNotification(`Reserva Web creada con éxito. ID: ${data.reservaId.slice(0, 8)}... Expiración en 15m.`, 'success');
        fetchData();
      } else {
        throw new Error(data.mensaje || 'Error al reservar');
      }
    } catch (err: any) {
      if (isUsingMocks) {
        simulateWebReservation();
      } else {
        showNotification(err.message || 'Error reservando stock', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const simulateWebReservation = () => {
    const product = products.find(p => p.sku === simProduct);
    if (!product) return;

    const stockItem = product.inventarios.find(inv => inv.ubicacion.nombre === simLocation);
    if (!stockItem || stockItem.stockDisponible < simQty) {
      showNotification('Stock insuficiente en la bodega de e-commerce.', 'error');
      return;
    }

    // Deduct stock from mock
    const updatedProducts = products.map(p => {
      if (p.sku === simProduct) {
        return {
          ...p,
          inventarios: p.inventarios.map(inv => {
            if (inv.ubicacion.nombre === simLocation) {
              return {
                ...inv,
                stockDisponible: inv.stockDisponible - simQty,
                stockReservado: inv.stockReservado + simQty
              };
            }
            return inv;
          })
        };
      }
      return p;
    });

    const resId = crypto.randomUUID();
    const newReservation: Reservation = {
      id: resId,
      cantidad: simQty,
      estado: 'Pendiente',
      fechaCreacion: new Date().toISOString(),
      fechaExpiracion: new Date(Date.now() + 15 * 60000).toISOString(),
      producto: { nombre: product.nombre, sku: product.sku },
      ubicacion: { nombre: simLocation }
    };

    const newLog: HistoryLog = {
      id: crypto.randomUUID(),
      cantidad: simQty,
      tipoMovimiento: 'Reserva_Creada',
      fechaHora: new Date().toISOString(),
      producto: { nombre: product.nombre, sku: product.sku },
      ubicacion: { nombre: simLocation },
      usuario: { username: 'sistema_ecommerce', rol: 'ECommerce' }
    };

    setProducts(updatedProducts);
    setReservations([newReservation, ...reservations]);
    setHistory([newLog, ...history]);
    showNotification('Reserva creada temporalmente en bodega (Simulado).', 'success');
  };

  // --- PROTOCOL BRIDGE: COMMIT WEB RESERVATION ---
  const handleCommitReserve = async (reservaId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/commit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reservaId })
      });

      const data = await res.json();
      if (res.status === 202) {
        showNotification(
          `[Protocol Bridge ESB] Confirmación enviada al ESB. ID de Rastreo: ${data.trackingId.slice(0, 8)}...`,
          'success'
        );
        setTimeout(fetchData, 1000);
      } else {
        throw new Error(data.mensaje || 'Error al confirmar la reserva');
      }
    } catch (err: any) {
      if (isUsingMocks) {
        simulateCommitWebReservation(reservaId);
      } else {
        showNotification(err.message || 'Error confirmando reserva', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const simulateCommitWebReservation = (reservaId: string) => {
    const reservation = reservations.find(r => r.id === reservaId);
    if (!reservation || reservation.estado !== 'Pendiente') return;

    // Update reservation state
    const updatedRes = reservations.map(r => r.id === reservaId ? { ...r, estado: 'Confirmada' } : r);

    // Update stock levels
    const updatedProds = products.map(p => {
      if (p.sku === reservation.producto.sku) {
        return {
          ...p,
          inventarios: p.inventarios.map(inv => {
            if (inv.ubicacion.nombre === reservation.ubicacion.nombre) {
              return {
                ...inv,
                stockReservado: inv.stockReservado - reservation.cantidad
              };
            }
            return inv;
          })
        };
      }
      return p;
    });

    const prodObj = products.find(p => p.sku === reservation.producto.sku);
    const price = prodObj ? Number(prodObj.precio) : 0;
    const totalOrder = price * reservation.cantidad;

    const mockOrder: Order = {
      id: crypto.randomUUID(),
      canal: 'E_Commerce',
      estado: 'Pagada',
      fechaCreacion: new Date().toISOString(),
      total: totalOrder,
      lineas: [{
        cantidad: reservation.cantidad,
        precioUnitario: price,
        producto: { nombre: reservation.producto.nombre, sku: reservation.producto.sku }
      }]
    };

    const newLog: HistoryLog = {
      id: crypto.randomUUID(),
      cantidad: reservation.cantidad,
      tipoMovimiento: 'Venta',
      fechaHora: new Date().toISOString(),
      producto: { nombre: reservation.producto.nombre, sku: reservation.producto.sku },
      ubicacion: { nombre: reservation.ubicacion.nombre },
      usuario: { username: 'sistema_ecommerce', rol: 'ECommerce' }
    };

    setReservations(updatedRes);
    setProducts(updatedProds);
    setOrders([mockOrder, ...orders]);
    setHistory([newLog, ...history]);
    showNotification('Pago recibido. Reserva consolidada a venta (Simulado).', 'success');
  };

  // RF-003: Product CRUD functions
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku || !newNombre || !newPrecio) return;
    setLoading(true);
    try {
      const initialStock = [
        { ubicacionNombre: 'Tienda Valdivia', cantidad: Number(newInitialStockValdivia) },
        { ubicacionNombre: 'Bodega E-commerce', cantidad: Number(newInitialStockEcommerce) }
      ];
      
      const res = await fetch(`${API_BASE_URL}/sales/products`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ sku: newSku, nombre: newNombre, precio: Number(newPrecio), initialStock })
      });
      const data = await res.json();
      if (res.status === 201) {
        showNotification('Producto creado exitosamente.', 'success');
        setNewSku('');
        setNewNombre('');
        setNewPrecio('');
        setNewInitialStockValdivia('0');
        setNewInitialStockEcommerce('0');
        fetchData();
      } else {
        throw new Error(data.mensaje || 'Error al crear producto');
      }
    } catch (err: any) {
      if (isUsingMocks) {
        const mockNewProduct: Product = {
          id: crypto.randomUUID(),
          sku: newSku,
          nombre: newNombre,
          precio: Number(newPrecio),
          inventarios: [
            { stockDisponible: Number(newInitialStockValdivia), stockReservado: 0, ubicacion: { nombre: 'Tienda Valdivia', tipo: 'Tienda' } },
            { stockDisponible: Number(newInitialStockEcommerce), stockReservado: 0, ubicacion: { nombre: 'Bodega E-commerce', tipo: 'Bodega' } }
          ]
        };
        setProducts([...products, mockNewProduct]);
        setNewSku('');
        setNewNombre('');
        setNewPrecio('');
        setNewInitialStockValdivia('0');
        setNewInitialStockEcommerce('0');
        showNotification('Producto creado (Simulado).', 'success');
      } else {
        showNotification(err.message || 'Error al crear producto', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSku || !editNombre || !editPrecio) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sales/products/${editingSku}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ nombre: editNombre, precio: Number(editPrecio) })
      });
      const data = await res.json();
      if (res.status === 200) {
        showNotification('Producto actualizado exitosamente.', 'success');
        setEditingSku(null);
        setEditNombre('');
        setEditPrecio('');
        fetchData();
      } else {
        throw new Error(data.mensaje || 'Error al actualizar producto');
      }
    } catch (err: any) {
      if (isUsingMocks) {
        setProducts(products.map(p => p.sku === editingSku ? { ...p, nombre: editNombre, precio: Number(editPrecio) } : p));
        setEditingSku(null);
        setEditNombre('');
        setEditPrecio('');
        showNotification('Producto actualizado (Simulado).', 'success');
      } else {
        showNotification(err.message || 'Error al actualizar producto', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockAddingSku || !addStockQty || !addStockLocation) return;
    const qtyNum = Number(addStockQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      showNotification('La cantidad debe ser un número mayor a 0.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sales/products/add-stock`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ sku: stockAddingSku, cantidad: qtyNum, ubicacion: addStockLocation })
      });
      const data = await res.json();
      if (res.status === 200) {
        showNotification('Stock agregado exitosamente.', 'success');
        setStockAddingSku(null);
        setAddStockQty('10');
        fetchData();
      } else {
        throw new Error(data.mensaje || 'Error al agregar stock');
      }
    } catch (err: any) {
      if (isUsingMocks) {
        setProducts(products.map(p => {
          if (p.sku === stockAddingSku) {
            return {
              ...p,
              inventarios: p.inventarios.map(inv => {
                if (inv.ubicacion.nombre === addStockLocation) {
                  return { ...inv, stockDisponible: inv.stockDisponible + qtyNum };
                }
                return inv;
              })
            };
          }
          return p;
        }));
        setStockAddingSku(null);
        setAddStockQty('10');
        showNotification('Stock agregado (Simulado).', 'success');
      } else {
        showNotification(err.message || 'Error al agregar stock', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // RF-004: Dispatch order
  const handleDispatchOrder = async (orderId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sales/orders/${orderId}/dispatch`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.status === 200) {
        showNotification('Orden despachada y registrada en el sistema.', 'success');
        fetchData();
      } else {
        throw new Error(data.mensaje || 'Error al despachar orden');
      }
    } catch (err: any) {
      if (isUsingMocks) {
        setOrders(orders.map(o => o.id === orderId ? { ...o, estado: 'Despachada' } : o));
        showNotification('Orden despachada (Simulado).', 'success');
      } else {
        showNotification(err.message || 'Error despachando orden', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // RF-005: Low stock alert checker
  const getLowStockAlerts = () => {
    const alerts: Array<{ product: Product; location: string; qty: number }> = [];
    products.forEach(p => {
      p.inventarios?.forEach(inv => {
        if (inv.stockDisponible <= 5) {
          alerts.push({
            product: p,
            location: inv.ubicacion.nombre,
            qty: inv.stockDisponible
          });
        }
      });
    });
    return alerts;
  };

  // LOGIN SCREEN
  if (!token) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '16px' }}>
        <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', borderTop: '4px solid var(--accent-blue)' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <span style={{ fontSize: '3.5rem' }}>📦</span>
            <h2 style={{ fontSize: '1.75rem', marginTop: '12px', letterSpacing: '-0.02em' }}>Sync-Stock Login</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Gestión de Inventario Omnicanal</p>
          </div>

          {notification && (
            <div className={`alert-box alert-${notification.type}`}>
              {notification.text}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>USUARIO</label>
              <input
                type="text"
                className="form-input"
                placeholder="vendedor1 o admin"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>CONTRASEÑA</label>
              <input
                type="password"
                className="form-input"
                placeholder="vendedor123 o admin123"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Autenticando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', fontSize: '0.8rem', border: '1px dashed rgba(59, 130, 246, 0.2)' }}>
            <strong style={{ color: 'var(--accent-blue)' }}>Credenciales Rápidas:</strong>
            <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>• Vendedor: <code style={{color: '#60a5fa'}}>vendedor1 / vendedor123</code></div>
            <div style={{ color: 'var(--text-muted)' }}>• Administrador: <code style={{color: '#60a5fa'}}>admin / admin123</code></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* HEADER SECTION */}
      <header className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px', padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '2rem' }}>📦</span>
          <div>
            <h1 style={{ fontSize: '1.5rem', letterSpacing: '-0.02em' }}>Sync-Stock</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {isUsingMocks ? (
                <span className="badge badge-warning">Demo Mode (Mock Offline)</span>
              ) : (
                <span className="badge badge-emerald">Conectado a API Real</span>
              )}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('pos')}
            className="btn-primary"
            style={{
              padding: '8px 16px',
              fontSize: '0.9rem',
              background: activeTab === 'pos' ? undefined : 'transparent',
              boxShadow: activeTab === 'pos' ? undefined : 'none',
              border: activeTab === 'pos' ? undefined : '1px solid var(--border-color)'
            }}
          >
            🛒 POS Vendedor
          </button>
          
          {(rol === 'Admin' || rol === 'ECommerce') && (
            <>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="btn-primary"
                style={{
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  background: activeTab === 'dashboard' ? undefined : 'transparent',
                  boxShadow: activeTab === 'dashboard' ? undefined : 'none',
                  border: activeTab === 'dashboard' ? undefined : '1px solid var(--border-color)'
                }}
              >
                📊 Stock Real-Time
              </button>

              <button
                onClick={() => setActiveTab('reservations')}
                className="btn-primary"
                style={{
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  background: activeTab === 'reservations' ? undefined : 'transparent',
                  boxShadow: activeTab === 'reservations' ? undefined : 'none',
                  border: activeTab === 'reservations' ? undefined : '1px solid var(--border-color)'
                }}
              >
                🌐 Reservas Web
              </button>

              {rol === 'Admin' && (
                <>
                  <button
                    onClick={() => setActiveTab('products')}
                    className="btn-primary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.9rem',
                      background: activeTab === 'products' ? undefined : 'transparent',
                      boxShadow: activeTab === 'products' ? undefined : 'none',
                      border: activeTab === 'products' ? undefined : '1px solid var(--border-color)'
                    }}
                  >
                    🛠️ Catálogo
                  </button>

                  <button
                    onClick={() => setActiveTab('history')}
                    className="btn-primary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.9rem',
                      background: activeTab === 'history' ? undefined : 'transparent',
                      boxShadow: activeTab === 'history' ? undefined : 'none',
                      border: activeTab === 'history' ? undefined : '1px solid var(--border-color)'
                    }}
                  >
                    📜 Auditoría ESB
                  </button>
                </>
              )}
            </>
          )}
        </nav>

        {/* User Info / Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{username}</div>
            <span className={`badge ${rol === 'Admin' ? 'badge-purple' : 'badge-blue'}`}>{rol}</span>
          </div>
          <button onClick={() => {
            handleLogout();
            showNotification('Sesión cerrada por simulación de inactividad.', 'warning');
          }} className="btn-primary" style={{ padding: '8px 12px', fontSize: '0.75rem', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.25)', marginRight: '8px', boxShadow: 'none' }}>
            ⏳ Simular Inactividad
          </button>
          <button onClick={handleLogout} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', boxShadow: 'none' }}>
            Salir
          </button>
        </div>
      </header>

      {/* NOTIFICATIONS BAR */}
      {notification && (
        <div className={`alert-box alert-${notification.type} animate-fade-in`}>
          {notification.text}
        </div>
      )}

      {/* ======================================= */}
      {/* TAB 1: POS VENDEDOR                     */}
      {/* ======================================= */}
      {activeTab === 'pos' && (
        <div className="grid-cols-1-2">
          
          {/* Catalog list */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Catálogo de Productos</h3>
              <div>
                <label style={{ fontSize: '0.8rem', marginRight: '8px', color: 'var(--text-muted)' }}>Local:</label>
                <select
                  value={posLocation}
                  onChange={(e) => {
                    setPosLocation(e.target.value);
                    setCart([]);
                  }}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '4px' }}
                >
                  <option value="Tienda Valdivia">Tienda Valdivia</option>
                  <option value="Bodega E-commerce">Bodega E-commerce</option>
                </select>
              </div>
            </div>

            <div className="grid-cards">
              {products.map((prod) => {
                const stockItem = prod.inventarios.find(i => i.ubicacion.nombre === posLocation);
                const stockDisp = stockItem ? stockItem.stockDisponible : 0;

                return (
                  <div key={prod.sku} className="glass-panel" style={{ background: 'rgba(10, 15, 29, 0.6)', padding: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '180px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span className="badge badge-blue">{prod.sku}</span>
                        <span style={{ fontSize: '0.85rem', color: stockDisp > 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>
                          Stock: {stockDisp}
                        </span>
                      </div>
                      <h4 style={{ marginTop: '12px', fontSize: '1rem', lineHeight: '1.3' }}>{prod.nombre}</h4>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                        ${Number(prod.precio).toLocaleString('es-CL')}
                      </span>
                      <button
                        onClick={() => addToCart(prod)}
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        disabled={stockDisp <= 0}
                      >
                        + Agregar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cart sidebar */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 'fit-content', minHeight: '400px' }}>
            <div>
              <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>🛒 Carro de Compras</h3>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                  El carro está vacío. Selecciona productos a la izquierda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {cart.map((item) => (
                    <div key={item.product.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(10, 15, 29, 0.4)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ flex: 1, marginRight: '12px' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.product.nombre}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>${Number(item.product.precio).toLocaleString('es-CL')} / u</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => updateCartQty(item.product.sku, item.qty - 1)}
                          style={{ width: '28px', height: '28px', background: 'var(--bg-tertiary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          -
                        </button>
                        <span style={{ width: '24px', textAlign: 'center', fontSize: '0.95rem', fontWeight: '600' }}>{item.qty}</span>
                        <button
                          onClick={() => updateCartQty(item.product.sku, item.qty + 1)}
                          style={{ width: '28px', height: '28px', background: 'var(--bg-tertiary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>
                  <span>Total:</span>
                  <span style={{ color: 'var(--accent-blue)' }}>${getCartTotal().toLocaleString('es-CL')}</span>
                </div>
                
                <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '16px', color: 'var(--text-muted)' }}>
                  💡 <strong>Puente de Protocolos (ESB):</strong> Al confirmar, la petición HTTP REST se encolará de inmediato en RabbitMQ. El procesamiento físico se realizará en segundo plano.
                </div>

                <button onClick={handlePOSCheckout} className="btn-success" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Enviando al bus...' : 'Confirmar y Facturar Venta'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================= */}
      {/* TAB 2: REAL-TIME STOCK LEVELS          */}
      {/* ======================================= */}
      {activeTab === 'dashboard' && (rol === 'Admin' || rol === 'ECommerce') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* RF-005: ALERTAS DE QUIEBRE DE STOCK */}
          <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-red)' }}>
            <h3>⚠️ Alertas de Quiebre de Stock (Umbral Crítico: 5 u)</h3>
            {getLowStockAlerts().length === 0 ? (
              <div style={{ color: '#34d399', fontSize: '0.9rem', padding: '8px 0' }}>
                🟢 Todos los productos cuentan con stock suficiente en todas las ubicaciones.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {getLowStockAlerts().map((alert, idx) => (
                  <div key={idx} className="alert-box alert-error" style={{ margin: 0, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      <strong>¡Alerta de Stock Bajo!</strong> El producto <strong>{alert.product.nombre}</strong> (SKU: <code>{alert.product.sku}</code>) tiene solo <strong>{alert.qty}</strong> unidades disponibles en <strong>{alert.location}</strong>.
                    </span>
                    <span className="badge badge-danger">Crítico</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Stock Levels Dashboard Grid */}
          <div className="glass-panel">
            <h3>Visualización de Stock Omnicanal (Tiendas y Bodegas)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>SKU</th>
                    <th>Disponible Tienda</th>
                    <th>Disponible Bodega</th>
                    <th>Reservado Tienda</th>
                    <th>Reservado Bodega</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((prod) => {
                    const invTienda = prod.inventarios.find(inv => inv.ubicacion.tipo === 'Tienda');
                    const invBodega = prod.inventarios.find(inv => inv.ubicacion.tipo === 'Bodega');

                    const dispTienda = invTienda ? invTienda.stockDisponible : 0;
                    const dispBodega = invBodega ? invBodega.stockDisponible : 0;
                    const resTienda = invTienda ? invTienda.stockReservado : 0;
                    const resBodega = invBodega ? invBodega.stockReservado : 0;

                    return (
                      <tr key={prod.sku}>
                        <td style={{ fontWeight: 600 }}>{prod.nombre}</td>
                        <td><span className="badge badge-blue">{prod.sku}</span></td>
                        <td style={{ color: dispTienda > 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                          {dispTienda} u
                        </td>
                        <td style={{ color: dispBodega > 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                          {dispBodega} u
                        </td>
                        <td style={{ color: '#60a5fa', fontWeight: 600 }}>
                          {resTienda} u
                        </td>
                        <td style={{ color: '#60a5fa', fontWeight: 600 }}>
                          {resBodega} u
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SIMULACIÓN DE RESERVAS E-COMMERCE */}
          <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
            <h3>Simulador de Reserva Web (Cliente E-commerce)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Simula la interacción de un cliente realizando una reserva de stock temporal en el e-commerce (esta reserva bloqueará temporalmente el stock e iniciará un TTL de 15 minutos).
            </p>

            <form onSubmit={handleReserveWeb} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Selecciona Producto</label>
                <select
                  className="form-input"
                  value={simProduct}
                  onChange={(e) => setSimProduct(e.target.value)}
                  style={{ background: 'var(--bg-primary)' }}
                >
                  {products.map(p => (
                    <option key={p.sku} value={p.sku}>{p.nombre} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Bodega de Despacho</label>
                <select
                  className="form-input"
                  value={simLocation}
                  onChange={(e) => setSimLocation(e.target.value)}
                  style={{ background: 'var(--bg-primary)' }}
                >
                  <option value="Bodega E-commerce">Bodega E-commerce</option>
                  <option value="Tienda Valdivia">Tienda Valdivia</option>
                </select>
              </div>

              <div style={{ width: '100px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Cantidad</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={simQty}
                  onChange={(e) => setSimQty(Number(e.target.value))}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ height: '45px' }} disabled={loading}>
                {loading ? 'Procesando...' : 'Crear Reserva Web'}
              </button>
            </form>
          </div>

          {/* Active Orders List */}
          <div className="glass-panel">
            <h3>Historial de Órdenes Consolidadas</h3>
            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>No hay órdenes registradas.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>ID de Orden</th>
                      <th>Canal</th>
                      <th>Total Venta</th>
                      <th>Estado</th>
                      <th>Fecha/Hora</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((ord) => (
                      <tr key={ord.id}>
                        <td><code style={{ color: 'var(--accent-blue)' }}>{ord.id.slice(0, 8)}...</code></td>
                        <td>
                          <span className={`badge ${ord.canal === 'POS_Fisico' ? 'badge-blue' : 'badge-emerald'}`}>
                            {ord.canal === 'POS_Fisico' ? 'POS FÍSICO' : 'E-COMMERCE'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>${Number(ord.total).toLocaleString('es-CL')}</td>
                        <td>
                          <span className={`badge ${
                            ord.estado === 'Pagada' ? 'badge-emerald' : 
                            ord.estado === 'Despachada' ? 'badge-blue' : 'badge-warning'
                          }`}>
                            {ord.estado}
                          </span>
                        </td>
                        <td>{new Date(ord.fechaCreacion).toLocaleString('es-CL')}</td>
                        <td>
                          {ord.estado === 'Pagada' ? (
                            <button
                              onClick={() => handleDispatchOrder(ord.id)}
                              className="btn-success"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'var(--accent-blue)', color: 'white', border: 'none' }}
                              disabled={loading}
                            >
                              📦 Despachar
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Despachado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================= */}
      {/* TAB 3: RESERVATIONS                     */}
      {/* ======================================= */}
      {activeTab === 'reservations' && (rol === 'Admin' || rol === 'ECommerce') && (
        <div className="glass-panel">
          <div style={{ marginBottom: '16px' }}>
            <h3>Reservas Activas de E-Commerce</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Reservas activas en espera de pago. El daemon de expiración las liberará automáticamente al cumplirse el tiempo límite. Puedes presionar "Consolidar Pago" para simular el éxito de la pasarela y liberar los productos.
            </p>
          </div>

          {reservations.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>No hay reservas e-commerce activas.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID Reserva</th>
                    <th>Producto</th>
                    <th>Bodega</th>
                    <th>Cantidad</th>
                    <th>Estado</th>
                    <th>Expiración (TTL)</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((res) => (
                    <tr key={res.id}>
                      <td><code style={{ color: 'var(--accent-purple)' }}>{res.id.slice(0, 8)}...</code></td>
                      <td style={{ fontWeight: 600 }}>{res.producto.nombre}</td>
                      <td>{res.ubicacion.nombre}</td>
                      <td>{res.cantidad} u</td>
                      <td>
                        <span className={`badge ${
                          res.estado === 'Pendiente' ? 'badge-warning' : 
                          res.estado === 'Confirmada' ? 'badge-emerald' : 'badge-danger'
                        }`}>
                          {res.estado}
                        </span>
                      </td>
                      <td>
                        {res.estado === 'Pendiente' ? (
                          <span style={{ color: '#fbbf24', fontSize: '0.85rem' }}>
                            {new Date(res.fechaExpiracion).toLocaleTimeString()}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td>
                        {res.estado === 'Pendiente' ? (
                          <button
                            onClick={() => handleCommitReserve(res.id)}
                            className="btn-success"
                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            disabled={loading}
                          >
                            💳 Consolidar Pago (ESB)
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Procesado</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================= */}
      {/* TAB 4: AUDIT LOGS (ESB HISTORY)         */}
      {/* ======================================= */}
      {activeTab === 'history' && rol === 'Admin' && (
        <div className="glass-panel">
          <div style={{ marginBottom: '16px' }}>
            <h3>Historial de Auditoría de Inventario (Logs del ESB)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Registro de auditoría consolidado del bus de servicios en tiempo real. Rastreabilidad completa de movimientos.
            </p>
          </div>

          {history.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>No hay registros de movimientos en el historial.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Fecha/Hora</th>
                    <th>Producto</th>
                    <th>Bodega</th>
                    <th>Cantidad</th>
                    <th>Tipo Movimiento</th>
                    <th>Operador</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.fechaHora).toLocaleString('es-CL')}</td>
                      <td>{log.producto.nombre}</td>
                      <td>{log.ubicacion.nombre}</td>
                      <td style={{ fontWeight: 600 }}>{log.cantidad} u</td>
                      <td>
                        <span className={`badge ${
                          log.tipoMovimiento === 'Venta' ? 'badge-emerald' :
                          log.tipoMovimiento === 'Reserva_Creada' ? 'badge-blue' :
                          log.tipoMovimiento === 'Reserva_Expirada' ? 'badge-danger' : 'badge-warning'
                        }`}>
                          {log.tipoMovimiento.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>
                          <strong>{log.usuario.username}</strong> ({log.usuario.rol})
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================= */}
      {/* TAB 5: GESTIÓN DE PRODUCTOS (CRUD)      */}
      {/* ======================================= */}
      {activeTab === 'products' && rol === 'Admin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Create Product Form */}
          <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
            <h3>🛠️ Registrar Nuevo Producto</h3>
            <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', marginTop: '16px' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>SKU (Código Único)</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  placeholder="PROD-001"
                />
              </div>

              <div style={{ flex: 2, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Nombre de Producto</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  placeholder="Camiseta Deportiva"
                />
              </div>

              <div style={{ width: '120px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Precio ($)</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="form-input"
                  value={newPrecio}
                  onChange={(e) => setNewPrecio(e.target.value)}
                  placeholder="19990"
                />
              </div>

              <div style={{ width: '120px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Stock Valdivia</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={newInitialStockValdivia}
                  onChange={(e) => setNewInitialStockValdivia(e.target.value)}
                />
              </div>

              <div style={{ width: '120px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Stock E-commerce</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={newInitialStockEcommerce}
                  onChange={(e) => setNewInitialStockEcommerce(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ height: '45px' }} disabled={loading}>
                {loading ? 'Guardando...' : 'Crear Producto'}
              </button>
            </form>
          </div>

          {/* Edit Product Section */}
          {editingSku && (
            <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
              <h3>✏️ Editar Producto: {editingSku}</h3>
              <form onSubmit={handleUpdateProduct} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', marginTop: '16px' }}>
                <div style={{ flex: 2, minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Nuevo Nombre</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                  />
                </div>

                <div style={{ width: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Nuevo Precio ($)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="form-input"
                    value={editPrecio}
                    onChange={(e) => setEditPrecio(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn-primary" style={{ height: '45px' }} disabled={loading}>
                    Guardar Cambios
                  </button>
                  <button type="button" className="btn-primary" onClick={() => setEditingSku(null)} style={{ height: '45px', background: 'transparent', border: '1px solid var(--border-color)', boxShadow: 'none' }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Add Stock Section */}
          {stockAddingSku && (
            <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-emerald)' }}>
              <h3>📥 Recibir Stock para Producto: {stockAddingSku}</h3>
              <form onSubmit={handleAddStock} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', marginTop: '16px' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Ubicación / Bodega</label>
                  <select
                    className="form-input"
                    value={addStockLocation}
                    onChange={(e) => setAddStockLocation(e.target.value)}
                  >
                    <option value="Tienda Valdivia">Tienda Valdivia</option>
                    <option value="Bodega E-commerce">Bodega E-commerce</option>
                  </select>
                </div>

                <div style={{ width: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Cantidad a Añadir</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="form-input"
                    value={addStockQty}
                    onChange={(e) => setAddStockQty(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn-primary" style={{ height: '45px', background: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)' }} disabled={loading}>
                    Agregar Stock
                  </button>
                  <button type="button" className="btn-primary" onClick={() => setStockAddingSku(null)} style={{ height: '45px', background: 'transparent', border: '1px solid var(--border-color)', boxShadow: 'none' }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Catalog list */}
          <div className="glass-panel">
            <h3>Catálogo de Artículos Registrados</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Nombre</th>
                    <th>Precio</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((prod) => (
                    <tr key={prod.sku}>
                      <td><span className="badge badge-blue">{prod.sku}</span></td>
                      <td style={{ fontWeight: 600 }}>{prod.nombre}</td>
                      <td>${prod.precio.toLocaleString('es-CL')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setEditingSku(prod.sku);
                              setEditNombre(prod.nombre);
                              setEditPrecio(prod.precio.toString());
                              setStockAddingSku(null);
                            }}
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.75rem', border: '1px solid var(--accent-blue)', background: 'transparent', color: 'var(--accent-blue)', boxShadow: 'none' }}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => {
                              setStockAddingSku(prod.sku);
                              setEditingSku(null);
                            }}
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.75rem', border: '1px solid var(--accent-emerald)', background: 'transparent', color: 'var(--accent-emerald)', boxShadow: 'none' }}
                          >
                            📥 Recibir Stock
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
