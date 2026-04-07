import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  User,
  MapPin,
  Briefcase,
  Plus,
  Trash2,
  ClipboardCheck
} from 'lucide-react';
import type {
  InventorInfo,
  CorrespondenceAddressInfo,
  AttorneyInfoData
} from '../../services/patent/patentApplicationService';

interface FilingInfoWizardProps {
  inventors: InventorInfo[];
  onInventorsChange: (inventors: InventorInfo[]) => void;
  correspondence: CorrespondenceAddressInfo | null;
  onCorrespondenceChange: (addr: CorrespondenceAddressInfo | null) => void;
  attorney: AttorneyInfoData | null;
  onAttorneyChange: (atty: AttorneyInfoData | null) => void;
  isOpen: boolean;
  onToggle: () => void;
  primaryInventorName: string;
  primaryCitizenship: string;
}

let inventorIdCounter = 1;

function newInventor(name = '', citizenship = ''): InventorInfo {
  return {
    id: `inv-${Date.now()}-${inventorIdCounter++}`,
    fullName: name,
    citizenship: citizenship || 'US',
    residence: { city: '', state: '', country: 'US' },
    mailingAddress: { street: '', city: '', state: '', zipCode: '', country: 'US' },
  };
}

const inputClass = 'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

type Section = 'inventors' | 'correspondence' | 'attorney' | null;

export function FilingInfoWizard({
  inventors,
  onInventorsChange,
  correspondence,
  onCorrespondenceChange,
  attorney,
  onAttorneyChange,
  isOpen,
  onToggle,
  primaryInventorName,
  primaryCitizenship,
}: FilingInfoWizardProps) {
  const [openSection, setOpenSection] = useState<Section>('inventors');

  // Initialize primary inventor if needed
  if (inventors.length === 0 && primaryInventorName) {
    const primary = newInventor(primaryInventorName, primaryCitizenship);
    onInventorsChange([primary]);
  }

  const toggleSection = (section: Section) => {
    setOpenSection(prev => prev === section ? null : section);
  };

  const updateInventor = (index: number, updates: Partial<InventorInfo>) => {
    const updated = [...inventors];
    updated[index] = { ...updated[index], ...updates };
    onInventorsChange(updated);
  };

  const updateInventorResidence = (index: number, field: string, value: string) => {
    const updated = [...inventors];
    updated[index] = {
      ...updated[index],
      residence: { ...updated[index].residence, [field]: value }
    };
    onInventorsChange(updated);
  };

  const addInventor = () => {
    onInventorsChange([...inventors, newInventor()]);
  };

  const removeInventor = (index: number) => {
    if (inventors.length <= 1) return;
    onInventorsChange(inventors.filter((_, i) => i !== index));
  };

  const updateCorrespondence = (field: string, value: string) => {
    const current = correspondence || { street: '', city: '', state: '', zipCode: '', country: 'US' };
    onCorrespondenceChange({ ...current, [field]: value });
  };

  const updateAttorney = (field: string, value: string) => {
    const current = attorney || {};
    onAttorneyChange({ ...current, [field]: value });
  };

  const filledSections = [
    inventors.some(inv => inv.fullName && inv.residence.city),
    correspondence && correspondence.street,
    attorney && (attorney.name || attorney.registrationNumber),
  ].filter(Boolean).length;

  return (
    <div className="mt-5 border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <ClipboardCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">While you wait: Complete filing details</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {filledSections}/3 sections started - saves automatically
            </p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {/* Inventors Section */}
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('inventors')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-gray-800">Inventors</span>
                <span className="text-xs text-gray-400">({inventors.length})</span>
              </div>
              {openSection === 'inventors' ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
            </button>
            {openSection === 'inventors' && (
              <div className="border-t border-gray-100 p-3 space-y-4">
                {inventors.map((inv, idx) => (
                  <div key={inv.id} className="space-y-2">
                    {inventors.length > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Inventor {idx + 1}</span>
                        {idx > 0 && (
                          <button onClick={() => removeInventor(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelClass}>Full Legal Name *</label>
                        <input
                          value={inv.fullName}
                          onChange={e => updateInventor(idx, { fullName: e.target.value })}
                          placeholder="e.g., Jane A. Smith"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Citizenship</label>
                        <input
                          value={inv.citizenship}
                          onChange={e => updateInventor(idx, { citizenship: e.target.value })}
                          placeholder="e.g., US"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>City *</label>
                        <input
                          value={inv.residence.city}
                          onChange={e => updateInventorResidence(idx, 'city', e.target.value)}
                          placeholder="City"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>State</label>
                        <input
                          value={inv.residence.state}
                          onChange={e => updateInventorResidence(idx, 'state', e.target.value)}
                          placeholder="State"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Country *</label>
                        <input
                          value={inv.residence.country}
                          onChange={e => updateInventorResidence(idx, 'country', e.target.value)}
                          placeholder="US"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addInventor}
                  className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add another inventor
                </button>
              </div>
            )}
          </div>

          {/* Correspondence Address */}
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('correspondence')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-800">Correspondence Address</span>
              </div>
              {openSection === 'correspondence' ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
            </button>
            {openSection === 'correspondence' && (
              <div className="border-t border-gray-100 p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className={labelClass}>Name / Firm</label>
                    <input
                      value={correspondence?.name || ''}
                      onChange={e => updateCorrespondence('name', e.target.value)}
                      placeholder="Name or firm name"
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Street Address</label>
                    <input
                      value={correspondence?.street || ''}
                      onChange={e => updateCorrespondence('street', e.target.value)}
                      placeholder="Street address"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <input
                      value={correspondence?.city || ''}
                      onChange={e => updateCorrespondence('city', e.target.value)}
                      placeholder="City"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>State</label>
                    <input
                      value={correspondence?.state || ''}
                      onChange={e => updateCorrespondence('state', e.target.value)}
                      placeholder="State"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>ZIP Code</label>
                    <input
                      value={correspondence?.zipCode || ''}
                      onChange={e => updateCorrespondence('zipCode', e.target.value)}
                      placeholder="ZIP"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Country</label>
                    <input
                      value={correspondence?.country || ''}
                      onChange={e => updateCorrespondence('country', e.target.value)}
                      placeholder="US"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input
                      value={correspondence?.phone || ''}
                      onChange={e => updateCorrespondence('phone', e.target.value)}
                      placeholder="(555) 123-4567"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input
                      value={correspondence?.email || ''}
                      onChange={e => updateCorrespondence('email', e.target.value)}
                      placeholder="email@example.com"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Attorney / Agent */}
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('attorney')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-gray-800">Attorney / Agent</span>
                <span className="text-xs text-gray-400">(optional)</span>
              </div>
              {openSection === 'attorney' ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
            </button>
            {openSection === 'attorney' && (
              <div className="border-t border-gray-100 p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Attorney Name</label>
                    <input
                      value={attorney?.name || ''}
                      onChange={e => updateAttorney('name', e.target.value)}
                      placeholder="Attorney name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Registration Number</label>
                    <input
                      value={attorney?.registrationNumber || ''}
                      onChange={e => updateAttorney('registrationNumber', e.target.value)}
                      placeholder="USPTO Reg. #"
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Firm Name</label>
                    <input
                      value={attorney?.firm || ''}
                      onChange={e => updateAttorney('firm', e.target.value)}
                      placeholder="Law firm name"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
