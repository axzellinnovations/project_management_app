'use client';

import React from 'react';
import { LayoutTemplate } from 'lucide-react';
import { Template } from './types';
import { predefinedTemplates } from '../data/templates';

export { predefinedTemplates };

interface TemplateSelectorProps {
  onSelect: (template: Template) => void;
}

export default function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  return (
    <div className="flex flex-col items-center justify-start h-full w-full py-12 px-8 bg-gray-50 overflow-y-auto">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-cu-primary/10 rounded-full mb-4">
            <LayoutTemplate size={32} className="text-cu-primary" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Create a new page</h2>
          <p className="text-gray-500 max-w-lg mx-auto">Choose a template to get started quickly or start from scratch.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
          {predefinedTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="group flex flex-col items-start p-6 bg-white border border-gray-200 rounded-xl hover:border-cu-primary hover:shadow-md transition-all text-left bg-gradient-to-br hover:from-white hover:to-blue-50/30"
            >
              <div className="flex-shrink-0 mb-4 p-3 bg-gray-50 rounded-lg group-hover:scale-110 transition-transform duration-200">
                {template.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-cu-primary transition-colors">
                  {template.name}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {template.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
