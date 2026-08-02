import React from 'react';

const FIELDS = [
  { id: 'title', label: 'Project Title', type: 'input', placeholder: 'e.g. Real-Time Flood Prediction Using Edge AI', required: true },
  { id: 'abstract', label: 'Abstract', type: 'textarea', placeholder: 'A short summary of the problem, approach and outcome...', required: true },
  { id: 'techStack', label: 'Tech Stack / Tools', type: 'input', placeholder: 'e.g. Python, TensorFlow, Raspberry Pi', required: true },
  { id: 'methodology', label: 'Methodology', type: 'textarea', placeholder: 'How the project was carried out...', required: true },
  { id: 'findings', label: 'Key Findings / Results', type: 'textarea', placeholder: 'What the project achieved or discovered...', required: true },
  { id: 'supervisor', label: 'Supervisor Name', type: 'input', placeholder: 'e.g. Dr. Aisha Rahman', required: true },
  { id: 'repoUrl', label: 'Repository URL (optional)', type: 'input', placeholder: 'https://github.com/...', required: false },
  { id: 'demoUrl', label: 'Demo URL (optional)', type: 'input', placeholder: 'https://...', required: false },
];

export { FIELDS as GUIDED_FIELDS };

/** Guided text-entry path — Option B of the FYP submission flow. */
export default function GuidedForm({ formData, onFieldChange }) {
  return (
    <div className="space-y-5">
      {FIELDS.map((field) => (
        <div key={field.id}>
          <label htmlFor={`fyp-${field.id}`} className="block text-xs font-semibold text-muted mb-1.5">
            {field.label}
            {field.required && <span className="text-crimson"> *</span>}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              id={`fyp-${field.id}`}
              rows={3}
              placeholder={field.placeholder}
              value={formData[field.id] || ''}
              onChange={(e) => onFieldChange(field.id, e.target.value)}
              required={field.required}
              className="w-full p-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] placeholder:text-black/20 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition leading-relaxed"
            />
          ) : (
            <input
              id={`fyp-${field.id}`}
              type="text"
              placeholder={field.placeholder}
              value={formData[field.id] || ''}
              onChange={(e) => onFieldChange(field.id, e.target.value)}
              required={field.required}
              className="w-full h-11 px-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] placeholder:text-black/20 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
            />
          )}
        </div>
      ))}
    </div>
  );
}
