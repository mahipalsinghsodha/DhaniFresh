import React from 'react';
import { FiCheckCircle, FiCircle, FiXCircle, FiTruck, FiPackage, FiClock, FiMapPin } from 'react-icons/fi';

const OrderTimeline = ({ order }) => {
  if (!order) return null;

  const {
    orderStatus,
    paymentStatus,
    isDelivered,
    trackingNumber,
    shippingProvider,
    cancelReason,
    returnRequest,
    statusHistory,
    createdAt,
    acceptedAt,
    deliveredAt
  } = order;

  // Helper to get history entry for a status
  const getHistory = (statusArr) => {
    return statusHistory?.find(h => statusArr.includes(h.status));
  };

  const isCancelled = orderStatus === 'CANCELLED' || ['CANCELLED', 'FAILED'].includes(paymentStatus);

  const isConfirmed =
    orderStatus === 'ACCEPTED' ||
    !!acceptedAt ||
    ['ASSIGNED_TO_COURIER', 'PICKED_UP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(orderStatus) ||
    isDelivered;

  const isShipped =
    ['SHIPPED', 'ASSIGNED_TO_COURIER', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(orderStatus) ||
    !!trackingNumber ||
    isDelivered;

  const isOutForDelivery =
    ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(orderStatus) ||
    isDelivered;

  const isDeliveredStep = isDelivered || orderStatus === 'DELIVERED';

  const placedHistory = getHistory(['PENDING', 'PENDING_ACCEPTANCE']) || (createdAt ? { updatedAt: createdAt } : null);
  const confirmedHistory = getHistory(['ACCEPTED', 'COD_CONFIRMED']) || (acceptedAt ? { updatedAt: acceptedAt } : null);
  const shippedHistory = getHistory(['SHIPPED', 'ASSIGNED_TO_COURIER', 'PICKED_UP']);
  const outHistory = getHistory(['OUT_FOR_DELIVERY']);
  const deliveredHistory = getHistory(['DELIVERED']) || (deliveredAt ? { updatedAt: deliveredAt } : null);

  const steps = [
    {
      id: 'placed',
      title: 'Order Placed',
      subtitle: placedHistory ? `Placed on ${new Date(placedHistory.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Order submitted',
      icon: FiPackage,
      isActive: true,
      isCompleted: isConfirmed || isShipped || isOutForDelivery || isDeliveredStep
    }
  ];

  if (isCancelled) {
    const cancelledHistory = getHistory(['CANCELLED']);
    steps.push({
      id: 'cancelled',
      title: 'Order Cancelled',
      subtitle: cancelReason ? `Reason: ${cancelReason}` : 'Order was cancelled',
      history: cancelledHistory,
      icon: FiXCircle,
      isActive: true,
      isCompleted: true,
      isError: true
    });
  } else {
    steps.push({
      id: 'confirmed',
      title: 'Order Confirmed',
      subtitle: isConfirmed
        ? (confirmedHistory ? `Confirmed on ${new Date(confirmedHistory.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Seller confirmed & packed')
        : 'Waiting for seller confirmation',
      icon: FiCheckCircle,
      isActive: isConfirmed,
      isCompleted: isShipped || isOutForDelivery || isDeliveredStep
    });

    steps.push({
      id: 'shipped',
      title: 'Shipped',
      subtitle: isShipped
        ? (trackingNumber ? `${shippingProvider || 'Courier'} - Tracking: ${trackingNumber}` : 'Item handed over to courier partner')
        : 'Item will be dispatched soon',
      icon: FiTruck,
      isActive: isShipped,
      isCompleted: isOutForDelivery || isDeliveredStep
    });

    steps.push({
      id: 'out_for_delivery',
      title: 'Out for Delivery',
      subtitle: isOutForDelivery
        ? (outHistory ? `Out for delivery on ${new Date(outHistory.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Courier partner is out for delivery')
        : 'Will be out for delivery upon reaching hub',
      icon: FiMapPin,
      isActive: isOutForDelivery,
      isCompleted: isDeliveredStep
    });

    steps.push({
      id: 'delivered',
      title: 'Delivered',
      subtitle: isDeliveredStep
        ? (deliveredHistory ? `Delivered on ${new Date(deliveredHistory.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Package successfully delivered')
        : 'Expected delivery at your address',
      icon: FiCheckCircle,
      isActive: isDeliveredStep,
      isCompleted: isDeliveredStep
    });
  }

  if (returnRequest && returnRequest.status && returnRequest.requestedAt) {
    const returnHistory = getHistory(['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED']);
    steps.push({
      id: 'return',
      title: `Return (${returnRequest.status})`,
      subtitle: returnRequest.reason ? `Reason: ${returnRequest.reason}` : 'Return process initiated',
      icon: FiClock,
      isActive: true,
      isCompleted: returnRequest.status === 'APPROVED',
      isWarning: returnRequest.status === 'PENDING',
      isError: returnRequest.status === 'REJECTED'
    });
  }

  return (
    <div className="flex flex-col mt-4 pt-2">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        
        let iconBg = 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-700';
        let lineBg = 'bg-gray-200 dark:bg-gray-700';

        if (step.isError) {
          iconBg = 'bg-red-50 dark:bg-red-950/40 text-red-500 border-red-500';
          lineBg = 'bg-red-400';
        } else if (step.isWarning) {
          iconBg = 'bg-amber-50 dark:bg-amber-950/40 text-amber-500 border-amber-500';
          lineBg = 'bg-amber-400';
        } else if (step.isActive) {
          iconBg = 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-500';
          if (step.isCompleted) {
            lineBg = 'bg-green-500';
          }
        }

        const Icon = step.icon;

        return (
          <div key={step.id} className="relative flex gap-4 pb-8 last:pb-2">
            {!isLast && (
              <div 
                className={`absolute left-[15px] top-8 bottom-[-4px] w-0.5 transition-colors duration-300 ${lineBg}`}
              />
            )}
            
            <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${iconBg}`}>
              <Icon size={16} />
            </div>

            <div className="flex flex-col justify-center">
              <span className={`text-sm font-bold transition-colors ${step.isActive ? (step.isError ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white') : 'text-gray-400 dark:text-gray-500'}`}>
                {step.title}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                {step.subtitle}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OrderTimeline;
