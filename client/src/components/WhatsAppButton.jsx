import { motion, AnimatePresence } from 'framer-motion'
import { FaWhatsapp } from 'react-icons/fa'
import { useSupportStore } from '../store/support'

// You can configure this to your actual support number
const WHATSAPP_NUMBER = '7665306403' // Replace with actual number
const MESSAGE = encodeURIComponent('Hi Daatasa, I need some help!')

const WhatsAppButton = () => {
  const isSupportOpen = useSupportStore(state => state.isOpen)

  if (isSupportOpen) return null

  return (
    <motion.a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${MESSAGE}`}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-24 lg:bottom-6 right-4 lg:right-6 z-[60] w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center text-white cursor-pointer shadow-[0_8px_25px_rgba(37,211,102,0.4)]"
      style={{ background: '#25D366' }} // Official WhatsApp Green
      title="Chat with us on WhatsApp"
    >
      <FaWhatsapp size={32} />
      
      {/* Pulse effect */}
      <span className="absolute w-full h-full rounded-full border-2 border-[#25D366] opacity-0 animate-[ping_2s_ease-in-out_infinite]" />
    </motion.a>
  )
}

export default WhatsAppButton
