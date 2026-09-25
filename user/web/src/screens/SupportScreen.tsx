import React, { useEffect, useState } from 'react';
import { SupportTicket } from '../types';
import { submitSupportTicketInFirestore, subscribeToSupportTickets } from '../services/userFirestoreService';
import { describeError } from '../utils/retry';
import { str } from '../utils/format';

export const SupportScreen: React.FC<{ customerId: string; onBack?: () => void }> = ({ customerId, onBack }) => {
  const [submitted, setSubmitted] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTab, setActiveTab] = useState<'faqs' | 'ticket' | 'my_tickets'>('faqs');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [category, setCategory] = useState('Payment / Refund Issue');
  const [bookingId, setBookingId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(
    () =>
      subscribeToSupportTickets(customerId, (rows) =>
        setTickets(
          rows.map((r) => ({
            id: r.id,
            category: str(r.category),
            bookingId: str(r.bookingId),
            description: str(r.description),
            status: r.status || 'Open',
            createdAt: str(r.createdAt?.toDate?.().toLocaleString('en-IN') ?? r.createdAt),
          })),
        ),
      ),
    [customerId],
  );

  const handleCreateTicket = async () => {
    if (description.trim().length < 10) {
      setError('Please describe the issue in at least 10 characters.');
      return;
    }
    const newTck = {
      customerId: customerId,
      customerName: 'Customer', // Would be from profile
      category,
      bookingId: bookingId.trim(),
      description: description.trim().slice(0, 2000),
      status: 'Open',
    };
    setSending(true);
    setError('');
    try {
      await submitSupportTicketInFirestore(newTck);
      setSubmitted(true);
      setDescription('');
      setBookingId('');
      setActiveTab('my_tickets');
      setTimeout(() => setSubmitted(false), 3000);
    } catch (e) {
      setError(describeError(e, 'We couldn’t submit your ticket. Please try again or call support.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 bg-[#F7F7F7] overflow-y-auto p-4 space-y-4 max-w-3xl w-full mx-auto">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-[#E21B23] mb-2">
          ← Back
        </button>
      )}
      <div>
        <h2 className="text-sm font-black text-[#111111] uppercase tracking-wider">HELP & SUPPORT</h2>
        <p className="text-[10px] text-gray-500">24/7 Assistance & Ticket System</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-gray-200 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('faqs')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${
            activeTab === 'faqs' ? 'bg-[#E31E24] text-white shadow-sm' : 'text-gray-600'
          }`}
        >
          FAQs
        </button>
        <button
          onClick={() => setActiveTab('ticket')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${
            activeTab === 'ticket' ? 'bg-[#E31E24] text-white shadow-sm' : 'text-gray-600'
          }`}
        >
          Raise Ticket
        </button>
        <button
          onClick={() => setActiveTab('my_tickets')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${
            activeTab === 'my_tickets' ? 'bg-[#E31E24] text-white shadow-sm' : 'text-gray-600'
          }`}
        >
          My Tickets ({tickets.length})
        </button>
      </div>

      {/* ── 1. FAQs TAB ── */}
      {activeTab === 'faqs' && (
        <div className="space-y-3">
          {[
            {
              q: 'How do I cancel my booking & get a refund?',
              a: 'You can cancel any booking directly from your Trips tab. Refunds are instantly initiated to your original payment method.',
            },
            {
              q: 'Are driver details shared before trip start?',
              a: 'Yes! As soon as a driver is assigned, their name, phone number, vehicle registration number, and live rating are visible.',
            },
            {
              q: 'What is Boarding OTP?',
              a: 'Boarding OTP is a 4-digit security code displayed on your active trip screen. Share this with your driver before starting.',
            },
            {
              q: 'How are toll and waiting charges calculated?',
              a: 'Tolls are added based on actual highway receipts. First 15 minutes of waiting at pickup is 100% free.',
            },
          ].map((faq, i) => (
            <div key={i} className="bg-white p-3.5 rounded-2xl border border-gray-200 space-y-1 shadow-sm">
              <h4 className="text-xs font-black text-[#111111]">Q: {faq.q}</h4>
              <p className="text-[11px] text-gray-600 leading-relaxed">{faq.a}</p>
            </div>
          ))}

          <div className="p-4 bg-white border border-gray-200 shadow-sm text-gray-900 rounded-2xl text-center space-y-2">
            <div className="text-xs font-bold">Still need help?</div>
            <a
              href="tel:8531970197"
              className="inline-flex items-center gap-2 bg-[#E31E24] text-white px-4 py-2 rounded-xl text-xs font-bold shadow hover:bg-[#C41820]"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>Call Helpline: 8531970197</span>
            </a>
          </div>
        </div>
      )}

      {/* ── 2. RAISE TICKET TAB ── */}
      {activeTab === 'ticket' && (
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <h3 className="text-xs font-black text-[#111111]">CREATE SUPPORT TICKET</h3>

          <div>
            <label className="text-[10px] font-bold text-gray-400 block mb-1">Issue Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-[#111111]"
            >
              <option>Payment / Refund Issue</option>
              <option>Driver Behavior / Route Issue</option>
              <option>Vehicle Condition Complaint</option>
              <option>Billing / Toll Discrepancy</option>
              <option>App / Technical Bug</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 block mb-1">Booking ID (Optional)</label>
            <input
              type="text"
              placeholder="e.g. NT260925-ABCDE"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 block mb-1">Detailed Description</label>
            <textarea
              placeholder="Please describe your issue in detail..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </p>
          )}
          <button
            onClick={() => void handleCreateTicket()}
            disabled={sending}
            className="w-full bg-[#E31E24] text-white py-3 rounded-xl font-bold text-xs shadow hover:bg-[#C41820] disabled:opacity-60"
          >
            {sending ? 'Submitting…' : 'Submit Ticket →'}
          </button>
        </div>
      )}

      {/* ── 3. MY TICKETS TAB ── */}
      {activeTab === 'my_tickets' && (
        <div className="space-y-2">
          {submitted && (
            <div className="bg-green-50 text-green-700 p-3 rounded-xl text-xs font-bold border border-green-200">
              Ticket submitted successfully!
            </div>
          )}
          {tickets.map((tck) => (
            <div key={tck.id} className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-[#111111]">{tck.id}</span>
                <span
                  className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                    tck.status === 'Resolved' ? 'bg-green-50 text-[#20A464]' : 'bg-amber-50 text-[#F59E0B]'
                  }`}
                >
                  {tck.status}
                </span>
              </div>
              <div className="text-[11px] font-bold text-[#E31E24]">{tck.category}</div>
              <p className="text-xs text-gray-600">{tck.description}</p>
              <div className="text-[9px] text-gray-400 text-right">Submitted {tck.createdAt}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
