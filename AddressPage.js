"use client";
import React, { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Package,
  MapPin,
  CreditCard,
  Truck,
  Loader2,
  RefreshCcw,
  Wifi,
  Star,
  Send,
  Navigation2,
  X,
  Navigation
} from "lucide-react";

// ⚠️ REPLACE THIS WITH YOUR ACTUAL MAPBOX TOKEN
mapboxgl.accessToken = "YOUR_MAPBOX_ACCESS_TOKEN";

// --- Sub-component: Live Tracking Map ---
function LiveTrackingMap({ order, riderLocation, onClose }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const destCoords = [order.address.longitude, order.address.latitude];
    const initialCenter = riderLocation ? [riderLocation.longitude, riderLocation.latitude] : destCoords;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/navigation-day-v1",
      center: initialCenter,
      zoom: 14,
      pitch: 45,
    });
    mapRef.current = map;

    map.on("load", () => {
      // Fix resize issues
      setTimeout(() => map.resize(), 500);

      // Add Destination Marker (Red)
      destMarkerRef.current = new mapboxgl.Marker({ color: "#ef4444" })
        .setLngLat(destCoords)
        .addTo(map);

      // Fit bounds if rider location exists
      if (riderLocation) {
        const bounds = new mapboxgl.LngLatBounds()
          .extend([riderLocation.longitude, riderLocation.latitude])
          .extend(destCoords);
        map.fitBounds(bounds, { padding: 80, duration: 1000 });
      }
    });

    return () => map.remove();
  }, []);

  // Update Rider Marker when location changes
  useEffect(() => {
    if (!mapRef.current || !riderLocation) return;
    const coords = [riderLocation.longitude, riderLocation.latitude];

    if (!riderMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "rider-marker";
      el.style.width = "20px"; el.style.height = "20px";
      el.style.backgroundColor = "#2563eb"; el.style.borderRadius = "50%";
      el.style.border = "3px solid white"; el.style.boxShadow = "0 0 15px rgba(37,99,235,0.5)";
      
      riderMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat(coords)
        .addTo(mapRef.current);
    } else {
      riderMarkerRef.current.setLngLat(coords);
    }

    // Optional: Follow rider
    // mapRef.current.easeTo({ center: coords, duration: 1000 });

  }, [riderLocation]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl h-[80vh] rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl relative">
        <div className="p-6 border-b flex justify-between items-center bg-white z-10">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-2xl text-white">
              <Navigation2 fill="white" size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">Live Tracking</h3>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Order #{order.orderId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-all">
            <X size={20} />
          </button>
        </div>
        
        <div ref={mapContainerRef} className="flex-1 w-full bg-slate-100" />
        
        <div className="p-6 bg-blue-50/50 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-sm font-bold text-gray-700">Rider is on the way to your location</p>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Destination</p>
              <p className="text-sm font-black text-gray-900">{order.address.street}</p>
           </div>
        </div>
      </div>
    </div>
  );
}

export default function OrdersList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [ratingStatuses, setRatingStatuses] = useState({});
  const [ratingForms, setRatingForms] = useState({});
  const [submittingRatings, setSubmittingRatings] = useState(new Set());
  
  // New States for Tracking
  const [riderLocations, setRiderLocations] = useState({}); // { orderId: { lat, lng } }
  const [trackingOrder, setTrackingOrder] = useState(null);

  const API_URL = "http://localhost:4000";

  const fetchOrders = async (socketId = null) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) return setError("No token found");
      const url = socketId ? `${API_URL}/orders?socketId=${socketId}` : `${API_URL}/orders`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) {
        setOrders(data.orders);
        data.orders.filter(o => o.status === "Delivered").forEach(o => fetchRatingStatus(o.orderId));
      } else { setError(data.message); }
    } catch (err) { setError("Network error"); }
    finally { setLoading(false); }
  };

  const fetchRatingStatus = async (orderId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/orders/${orderId}/rating-status`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setRatingStatuses(prev => ({ ...prev, [orderId]: data }));
    } catch (err) { console.error(err); }
  };

  const submitRatings = async (orderId) => {
    const form = ratingForms[orderId];
    if (!form) return;
    setSubmittingRatings(prev => new Set(prev).add(orderId));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/orders/${orderId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setRatingStatuses(prev => ({ ...prev, [orderId]: { has_rated: true, ratings: data } }));
        setRatingForms(prev => { const n = {...prev}; delete n[orderId]; return n; });
      }
    } finally { setSubmittingRatings(prev => { const n = new Set(prev); n.delete(orderId); return n; }); }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const s = io(API_URL, { auth: { token }, transports: ["websocket"] });
    setSocket(s);

    s.on("connect", () => {
      setSocketConnected(true);
      fetchOrders(s.id);
    });
    s.on("disconnect", () => setSocketConnected(false));
    
    // 📍 Real-time updates
    s.on("orders:new", (o) => setOrders(prev => [o, ...prev]));
    s.on("orders:status", (upd) => {
      setOrders(prev => prev.map(o => o.orderId === upd.orderId ? { ...o, status: upd.status } : o));
      if (upd.status === "Delivered") fetchRatingStatus(upd.orderId);
    });

    s.on("rider:location-update", ({ orderId, latitude, longitude }) => {
      console.log("📍 Location update received:", orderId, latitude, longitude);
      setRiderLocations(prev => ({
        ...prev,
        [orderId]: { latitude, longitude }
      }));
    });

    return () => s.disconnect();
  }, []);

  const renderStars = (rating) => (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={14} className={i < rating ? "text-yellow-400 fill-current" : "text-gray-300"} />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tighter">MY ORDERS</h1>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">Manage and track your deliveries</p>
          </div>
          <button onClick={() => fetchOrders()} className="p-4 bg-white shadow-xl shadow-gray-200/50 rounded-2xl hover:bg-gray-50 transition-all"><RefreshCcw size={20} className="text-blue-600" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2">
            {orders.map((order) => {
              const loc = riderLocations[order.orderId];
              const rStatus = ratingStatuses[order.orderId];
              const canTrack = ["Accepted", "Assigned", "OutForDelivery"].includes(order.status);

              return (
                <div key={order._id} className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-gray-200/30 border border-gray-100 flex flex-col relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-[10px] font-black text-gray-300 tracking-widest uppercase mb-1">ID: {order.orderId}</p>
                      <h3 className="text-xl font-black text-gray-900">Order Summary</h3>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === 'Delivered' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                      {order.status}
                    </div>
                  </div>

                  <div className="space-y-5 mb-8">
                     <div className="flex gap-4">
                        <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl h-fit"><MapPin size={22} /></div>
                        <div>
                          <p className="font-black text-gray-900">{order.address.houseNo}, {order.address.street}</p>
                          <p className="text-xs font-bold text-gray-400 uppercase">{order.address.city} • {order.address.pincode}</p>
                        </div>
                     </div>
                     <div className="flex gap-4 items-center">
                        <div className="bg-green-50 text-green-600 p-3 rounded-2xl"><CreditCard size={22} /></div>
                        <p className="font-black text-gray-900">₹{order.pricing.grandTotal} <span className="text-gray-300 ml-1 font-bold italic">({order.payment.method.toUpperCase()})</span></p>
                     </div>
                  </div>

                  {canTrack && (
                    <button 
                      onClick={() => setTrackingOrder(order)}
                      className="mb-4 bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                    >
                      <Navigation fill="white" size={18} /> LIVE TRACK RIDER
                    </button>
                  )}

                  {order.status === "Delivered" && (
                    <div className="mt-4 pt-6 border-t border-dashed">
                      <h4 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">⭐ RATE YOUR EXPERIENCE</h4>
                      {rStatus?.has_rated ? (
                         <div className="bg-gray-50 p-4 rounded-2xl">
                            <div className="flex justify-between items-center mb-2">
                               <p className="text-[10px] font-black text-gray-400 uppercase">Food & Service</p>
                               {renderStars(rStatus.ratings.order_rating.rating)}
                            </div>
                            <p className="text-xs font-bold text-gray-600 italic">"{rStatus.ratings.order_rating.review_text || 'No review left'}"</p>
                         </div>
                      ) : (
                        <div className="space-y-4">
                           <div className="flex gap-4">
                              <select 
                                onChange={(e) => setRatingForms(p => ({...p, [order.orderId]: {...p[order.orderId], order_rating: { rating: parseInt(e.target.value) }}}))}
                                className="flex-1 bg-gray-50 border-none rounded-xl text-xs font-bold p-3 outline-none"
                              >
                                <option>Rate Food</option>
                                {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} Stars</option>)}
                              </select>
                              <select 
                                onChange={(e) => setRatingForms(p => ({...p, [order.orderId]: {...p[order.orderId], rider_rating: { rating: parseInt(e.target.value) }}}))}
                                className="flex-1 bg-gray-50 border-none rounded-xl text-xs font-bold p-3 outline-none"
                              >
                                <option>Rate Rider</option>
                                {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} Stars</option>)}
                              </select>
                           </div>
                           <button 
                            onClick={() => submitRatings(order.orderId)}
                            disabled={submittingRatings.has(order.orderId)}
                            className="w-full bg-gray-900 text-white text-[10px] font-black py-3 rounded-xl hover:bg-black transition-all"
                           >
                            SUBMIT RATINGS
                           </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {trackingOrder && (
        <LiveTrackingMap 
          order={trackingOrder} 
          riderLocation={riderLocations[trackingOrder.orderId]} 
          onClose={() => setTrackingOrder(null)} 
        />
      )}
    </div>
  );
}
