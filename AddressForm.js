"use client";
import React, { useState } from "react";
import { MapPin, Loader2, Navigation } from "lucide-react";

const API_URL = "http://localhost:4000";

export default function AddressForm({ onAddressCreated }) {
  const [formData, setFormData] = useState({
    label: "",
    houseNo: "",
    street: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    latitude: "",
    longitude: "",
    isDefault: false,
  });

  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setFormData((prev) => ({ ...prev, latitude, longitude }));

        try {
          const token = localStorage.getItem("token");
          const res = await fetch(
            `${API_URL}/user/addresses/geocode?latitude=${latitude}&longitude=${longitude}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          const data = await res.json();

          if (data.ok) {
            setFormData((prev) => ({
              ...prev,
              ...data.address,
              latitude,
              longitude,
            }));
          } else {
            setError(data.message || "Failed to fetch address details");
          }
        } catch (err) {
          setError("Error fetching address from coordinates");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setError("Unable to retrieve your location");
        setLocating(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/user/addresses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.ok) {
        if (onAddressCreated) onAddressCreated(data.address);
        // Reset form
        setFormData({
          label: "",
          houseNo: "",
          street: "",
          landmark: "",
          city: "",
          state: "",
          pincode: "",
          latitude: "",
          longitude: "",
          isDefault: false,
        });
        alert("Address added successfully!");
      } else {
        setError(data.message || "Failed to create address");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" /> Add New Address
        </h2>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-all"
        >
          {locating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Navigation className="w-4 h-4" />
          )}
          Use My Current Location
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Label (e.g. Home, Office)</label>
          <input
            type="text"
            name="label"
            value={formData.label}
            onChange={handleChange}
            placeholder="Home"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">House No.</label>
            <input
              type="text"
              name="houseNo"
              value={formData.houseNo}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Pincode</label>
            <input
              type="text"
              name="pincode"
              value={formData.pincode}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Street / Area</label>
          <input
            type="text"
            name="street"
            value={formData.street}
            onChange={handleChange}
            required
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Landmark</label>
          <input
            type="text"
            name="landmark"
            value={formData.landmark}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">City</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">State</label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isDefault"
            checked={formData.isDefault}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          />
          <label className="text-sm text-gray-700">Set as default address</label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-all font-semibold flex justify-center items-center"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Address"}
        </button>
      </form>
    </div>
  );
}
