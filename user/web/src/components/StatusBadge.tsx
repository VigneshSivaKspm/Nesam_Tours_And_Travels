import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let style = 'bg-gray-100 text-gray-700 border-gray-300';

  switch (status) {
    case 'Confirmed':
    case 'Completed':
    case 'Paid':
    case 'Resolved':
      style = 'bg-green-50 text-[#20A464] border-green-200';
      break;
    case 'Driver Assigned':
    case 'Driver Near Pickup':
    case 'Driver Arrived':
    case 'Trip Started':
    case 'Ongoing':
      style = 'bg-red-50 text-[#E21E26] border-red-200 font-bold animate-pulse';
      break;
    case 'Pending':
    case 'In Progress':
    case 'Refund Processing':
      style = 'bg-amber-50 text-[#F59E0B] border-amber-200';
      break;
    case 'Cancelled':
    case 'Refunded':
    case 'Payment Failed':
      style = 'bg-rose-50 text-[#D92D20] border-rose-200';
      break;
    default:
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {status}
    </span>
  );
};
