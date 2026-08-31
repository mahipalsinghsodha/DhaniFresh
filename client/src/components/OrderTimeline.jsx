import React from 'react';
import { FiCheckCircle, FiCircle, FiXCircle, FiTruck, FiPackage, FiClock } from 'react-icons/fi';

const OrderTimeline = ({ order }) => {
  if (!order) return null;

  const { paymentStatus, isDelivered, trackingNumber, shippingProvider, cancelReason, returnRequest, statusHistory } = order;

  // Helper to get history entry for a status
  const getHistory = (statusArr) => {
    return statusHistory?.find(h => statusArr.includes(h.status));
  };

  const isConfirmed = order.orderStatus === 'ACCEPTED' || !!order.acceptedAt || ['ASSIGNED_TO_COURIER', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'SHIPPED'].includes(order.orderStatus) || paymentStatus === 'COD_CONFIRMED' || (paymentStatus === 'PAID' && order.orderStatus !== 'PENDING_ACCEPTANCE') || isDelivered;

  const steps = [
    {
      id: 'placed',
      title: 'Order Placed',
      icon: FiPackage,
      history: getHistory(['PENDING', 'PENDING_ACCEPTANCE']) || (order.createdAt ? { updatedAt: order.createdAt } : null),
      isActive: true, // Always placed if we have an order
      isCompleted: true
    },
    {
      id: 'confirmed',
      title: 'Order Confirmed',
      icon: FiCheckCircle,
      history: getHistory(['ACCEPTED', 'COD_CONFIRMED', 'PAID']),
      isActive: isConfirmed,
      isCompleted: isConfirmed
    }
  ];

  const isCancelled = paymentStatus === 'CANCELLED' || order.orderStatus === 'CANCELLED';

  if (isCancelled) {
    steps.push({
      id: 'cancelled',
      title: 'Order Cancelled',
      icon: FiXCircle,
      history: getHistory(['CANCELLED']),
      isActive: true,
      isCompleted: true,
      extraInfo: cancelReason || 'Cancelled'
    });
  } else {
    steps.push({
      id: 'shipped',
      title: 'Shipped',
      icon: FiTruck,
      history: getHistory(['SHIPPED', 'PICKED_UP', 'ASSIGNED_TO_COURIER']),
      isActive: ['ASSIGNED_TO_COURIER', 'PICKED_UP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.orderStatus) || !!trackingNumber,
      isCompleted: ['ASSIGNED_TO_COURIER', 'PICKED_UP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.orderStatus) || !!trackingNumber,
      extraInfo: trackingNumber ? `Via ${shippingProvider || 'Courier'} - Tracking: ${trackingNumber}` : null
    });

    steps.push({
      id: 'delivered',
      title: 'Delivered',
      icon: FiCheckCircle,
      history: getHistory(['DELIVERED']),
      isActive: order.orderStatus === 'DELIVERED' || isDelivered,
      isCompleted: order.orderStatus === 'DELIVERED' || isDelivered
    });
  }

  if (returnRequest && returnRequest.status) {
    steps.push({
      id: 'return',
      title: `Return ${returnRequest.status}`,
      icon: FiClock,
      history: getHistory(['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED']),
      isActive: true,
      isCompleted: true,
      extraInfo: returnRequest.reason
    });
  }

  return (
    <div className="flex flex-col mt-4 pt-2">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const activeColor = step.id === 'cancelled' ? 'text-red-500' : 'text-green-500';
        const Icon = step.icon;

        return (
          <div key={step.id} className="relative flex gap-4 pb-8">
            {!isLast && (
              <div 
                className={`absolute left-[11px] top-6 bottom-[-8px] w-0.5 ${step.isCompleted && steps[index + 1]?.isActive ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`}
              ></div>
            )}
            
            <div className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white dark:bg-[var(--bg-card)] ${step.isActive ? activeColor : 'text-gray-300 dark:text-gray-600'}`}>
              <Icon size={24} className={step.isActive ? activeColor : 'text-gray-300 dark:text-gray-600'} />
            </div>

            <div className="flex flex-col -mt-1">
              <span className={`text-sm font-semibold ${step.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                {step.title}
              </span>
              {step.history && (
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(step.history.updatedAt).toLocaleString()}
                </span>
              )}
              {step.extraInfo && (
                <span className="text-xs text-gray-600 dark:text-gray-300 mt-1 italic">
                  {step.extraInfo}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OrderTimeline;
