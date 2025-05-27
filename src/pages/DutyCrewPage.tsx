import { useState } from "react";
import { DutyCrewSchedule } from "../components/dutyCrew/DutyCrewSchedule";
import { DutyCrewAdmin } from "../components/dutyCrew/DutyCrewAdmin";
import { CalendarIcon, UserGroupIcon, Cog6ToothIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Tab } from "@headlessui/react";

export function DutyCrewPage() {
  const adminAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "admin" });
  
  // Define the tabs based on admin access
  const tabs = [
    { name: "Schedule", icon: CalendarIcon },
    ...(adminAccess === true ? [{ name: "Administration", icon: Cog6ToothIcon }] : [])
  ];
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Duty Crew Management</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
          <span className="font-medium">Current Month: </span>
          {new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
        </div>
      </div>
      
      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-700 p-1 mb-6">
          {tabs.map((tab) => (
            <Tab
              key={tab.name}
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 flex items-center justify-center
                 ${selected
                  ? 'bg-white dark:bg-gray-800 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-800 dark:hover:text-white'}`
              }
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.name}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels>
          <Tab.Panel>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Duty Crew Schedule */}
              <div className="lg:col-span-2">
                <DutyCrewSchedule />
              </div>
              
              {/* Duty Crew Info */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                    Duty Crew Information
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                    How duty crews are assigned
                  </p>
                </div>
                <div className="px-4 py-5 sm:p-6">
                  <ul className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                    <li className="flex items-start">
                      <CalendarIcon className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Duty Crew 1:</strong> First Sunday of each month
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CalendarIcon className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Duty Crew 2:</strong> Second Sunday of each month
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CalendarIcon className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Duty Crew 3:</strong> Third Sunday of each month
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CalendarIcon className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Duty Crew 4:</strong> Fourth Sunday of each month
                      </span>
                    </li>
                    <li className="flex items-start">
                      <UserGroupIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>All Duty Crews:</strong> Fifth Sunday (when applicable)
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </Tab.Panel>
          
          {adminAccess === true && (
            <Tab.Panel>
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <ClipboardDocumentListIcon className="h-6 w-6 text-indigo-500 mr-2" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Duty Crew Administration</h2>
                </div>
                <DutyCrewAdmin />
              </div>
            </Tab.Panel>
          )}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
