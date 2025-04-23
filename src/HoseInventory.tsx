import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";

type Status = "With district for repair" | "Condemned" | "Due for testing" | "In date";
type Size = "25" | "38" | "65";
type Type = "Canvas" | "Duraline";

const statusColors = {
  "Condemned": "bg-red-100 text-red-800",
  "Due for testing": "bg-yellow-100 text-yellow-800",
  "With district for repair": "bg-blue-100 text-blue-800",
  "In date": "bg-green-100 text-green-800",
} as const;

export function HoseInventory() {
  const [filters, setFilters] = useState({
    status: "" as Status | "",
    size: "" as Size | "",
    type: "" as Type | "",
    search: "",
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHose, setEditingHose] = useState<Id<"hoses"> | null>(null);

  const hoses = useQuery(api.hoses.list, {
    status: filters.status || undefined,
    size: filters.size || undefined,
    type: filters.type || undefined,
    search: filters.search || undefined,
  });

  if (hoses === undefined) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Hose Inventory</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-red-700 text-white px-4 py-2 rounded-lg hover:bg-red-800 transition-colors"
        >
          Add New Hose
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <input
          type="text"
          placeholder="Search hose ID..."
          value={filters.search}
          onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
          className="border rounded-lg px-3 py-2"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters(f => ({ ...f, status: e.target.value as Status | "" }))}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">All Statuses</option>
          <option value="Condemned">Condemned</option>
          <option value="Due for testing">Due for testing</option>
          <option value="With district for repair">With district for repair</option>
          <option value="In date">In date</option>
        </select>
        <select
          value={filters.size}
          onChange={(e) => setFilters(f => ({ ...f, size: e.target.value as Size | "" }))}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">All Sizes</option>
          <option value="25">25mm</option>
          <option value="38">38mm</option>
          <option value="65">65mm</option>
        </select>
        <select
          value={filters.type}
          onChange={(e) => setFilters(f => ({ ...f, type: e.target.value as Type | "" }))}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">All Types</option>
          <option value="Canvas">Canvas</option>
          <option value="Duraline">Duraline</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hoses.map((hose) => (
          <div
            key={hose._id}
            className="bg-white rounded-lg shadow-sm p-4 border"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold">{hose.hoseId}</h3>
              <span className={`px-2 py-1 rounded-full text-sm ${statusColors[hose.status]}`}>
                {hose.status}
              </span>
            </div>
            <div className="space-y-2 text-gray-600">
              <p>Size: {hose.size}mm</p>
              <p>Length: {hose.length}m</p>
              <p>Type: {hose.type}</p>
              <p>Last Tested: {new Date(hose.testDate).toLocaleDateString()}</p>
            </div>
            <button
              onClick={() => setEditingHose(hose._id)}
              className="mt-4 text-red-700 hover:text-red-800 font-medium"
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      {(showAddForm || editingHose) && (
        <HoseForm
          hoseId={editingHose}
          onClose={() => {
            setShowAddForm(false);
            setEditingHose(null);
          }}
        />
      )}
    </div>
  );
}

function HoseForm({ hoseId, onClose }: { hoseId: Id<"hoses"> | null, onClose: () => void }) {
  const hoses = useQuery(api.hoses.list, {});
  const hose = hoses?.find(h => h._id === hoseId);
  const add = useMutation(api.hoses.add);
  const update = useMutation(api.hoses.update);

  const [formData, setFormData] = useState({
    hoseId: hose?.hoseId || "",
    length: hose?.length || 0,
    size: hose?.size || "25" as Size,
    type: hose?.type || "Canvas" as Type,
    testDate: hose?.testDate ? new Date(hose.testDate).toISOString().split('T')[0] : "",
    status: hose?.status || "In date" as Status,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (hoseId) {
        await update({
          id: hoseId,
          length: formData.length,
          size: formData.size,
          type: formData.type,
          testDate: new Date(formData.testDate).getTime(),
          status: formData.status,
        });
        toast.success("Hose updated successfully");
      } else {
        await add({
          hoseId: formData.hoseId,
          length: formData.length,
          size: formData.size,
          type: formData.type,
          testDate: new Date(formData.testDate).getTime(),
          status: formData.status,
        });
        toast.success("Hose added successfully");
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">{hoseId ? "Edit" : "Add"} Hose</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Hose ID</label>
            <input
              type="text"
              value={formData.hoseId}
              onChange={(e) => setFormData(f => ({ ...f, hoseId: e.target.value }))}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              placeholder="WV0001"
              required
              disabled={!!hoseId}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Length (m)</label>
            <input
              type="number"
              value={formData.length}
              onChange={(e) => setFormData(f => ({ ...f, length: Number(e.target.value) }))}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Size</label>
            <select
              value={formData.size}
              onChange={(e) => setFormData(f => ({ ...f, size: e.target.value as Size }))}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              required
            >
              <option value="25">25mm</option>
              <option value="38">38mm</option>
              <option value="65">65mm</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(f => ({ ...f, type: e.target.value as Type }))}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              required
            >
              <option value="Canvas">Canvas</option>
              <option value="Duraline">Duraline</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Test Date</label>
            <input
              type="date"
              value={formData.testDate}
              onChange={(e) => setFormData(f => ({ ...f, testDate: e.target.value }))}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(f => ({ ...f, status: e.target.value as Status }))}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              required
            >
              <option value="In date">In date</option>
              <option value="Due for testing">Due for testing</option>
              <option value="With district for repair">With district for repair</option>
              <option value="Condemned">Condemned</option>
            </select>
          </div>
          <div className="flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800"
            >
              {hoseId ? "Update" : "Add"} Hose
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
