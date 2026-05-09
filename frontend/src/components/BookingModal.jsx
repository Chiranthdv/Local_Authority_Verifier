import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "react-toastify";

function BookingModal({ worker, onClose }) {
  const [form, setForm] = useState({
    description: "",
    address: "",
    scheduledTime: ""
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));

      if (!user) {
        toast.warning("Please login first");
        return;
      }

      setLoading(true);

      const res = await fetch("http://localhost:5000/api/jobs/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customerId: user._id,
          workerId: worker?.userId?._id,
          ...form
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error();
      }

      toast.success("✅ Booking confirmed!");
      onClose();

    } catch (err) {
      console.error(err);
      toast.error("❌ Booking failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 p-6 rounded-2xl w-full max-w-md border border-white/10 shadow-xl"
      >

        <h2 className="text-xl font-semibold mb-4 text-white">
          Book {worker?.userId?.name}
        </h2>

        <input
          placeholder="Describe your issue"
          className="w-full p-3 mb-3 bg-gray-800 text-white rounded-lg outline-none"
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <input
          placeholder="Address"
          className="w-full p-3 mb-3 bg-gray-800 text-white rounded-lg outline-none"
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />

        <input
          type="datetime-local"
          className="w-full p-3 mb-4 bg-gray-800 text-white rounded-lg outline-none"
          onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
        />

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`flex-1 py-2 rounded-lg ${
              loading
                ? "bg-gray-500"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Booking..." : "Confirm"}
          </button>

          <button
            onClick={onClose}
            className="flex-1 bg-gray-600 py-2 rounded-lg hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>

      </motion.div>
    </div>
  );
}

export default BookingModal;