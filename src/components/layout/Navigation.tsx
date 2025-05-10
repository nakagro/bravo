import { useState } from "react";

// This component will be used in the future when we have multiple pages
export function Navigation() {
  // Default to the home page for now
  const [activeTab, setActiveTab] = useState("/");

  const navItems = [
    { name: "Hoses", path: "/", icon: "🧯" },
    // Future navigation items will be added here
    // { name: "Duty Crew", path: "/duty-crew", icon: "👨‍🚒" },
    // { name: "Appliances", path: "/appliances", icon: "🚒" },
    // { name: "Availability", path: "/availability", icon: "📅" },
  ];

  return (
    <nav className="bg-white shadow-sm mb-6 rounded-lg overflow-hidden">
      <div className="flex overflow-x-auto">
        {navItems.map((item) => (
          <a
            key={item.path}
            href={item.path}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap flex items-center ${
              activeTab === item.path
                ? "text-red-700 border-b-2 border-red-700"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
            onClick={(e) => {
              // This is just a placeholder for now
              // In the future, we'll use React Router for navigation
              if (item.path === "/") {
                e.preventDefault();
                setActiveTab(item.path);
              }
            }}
          >
            <span className="mr-2">{item.icon}</span>
            {item.name}
          </a>
        ))}
      </div>
    </nav>
  );
}
