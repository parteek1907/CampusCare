import { $ } from './utils';

export class DatePicker {
    private input: HTMLInputElement;
    private calendar: HTMLDivElement | null = null;
    private currentDate: Date;
    private isOpen = false;

    constructor(inputSelector: string | HTMLInputElement) {
        this.input = typeof inputSelector === 'string' ? $<HTMLInputElement>(inputSelector) : inputSelector;

        // Initialize with input value or today
        const initialVal = this.input.value;
        this.currentDate = initialVal ? new Date(initialVal) : new Date();
        if (isNaN(this.currentDate.getTime())) this.currentDate = new Date(); // Fallback

        this.init();
    }

    private init() {
        // Force text type to avoid browser picker
        this.input.type = 'text';
        this.input.readOnly = true;
        this.input.style.cursor = 'pointer';
        this.input.placeholder = 'Select Date (YYYY-MM-DD)';

        // Open on click
        this.input.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isOpen && this.calendar && !this.calendar.contains(e.target as Node) && e.target !== this.input) {
                this.close();
            }
        });
    }

    private toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    private open() {
        if (this.isOpen) return;
        this.isOpen = true;

        // Create Container
        this.calendar = document.createElement('div');
        this.calendar.className = 'custom-datepicker card fade-in';
        Object.assign(this.calendar.style, {
            position: 'absolute',
            zIndex: '1000',
            padding: '1rem',
            width: '280px',
            marginTop: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            background: 'white'
        });

        // Position
        // Simple positioning: right below the input. 
        // More complex positioning (popper.js) is overkill for now unless requested.
        // We append to body to avoid overflow:hidden issues, requiring absolute coords.
        const rect = this.input.getBoundingClientRect();
        this.calendar.style.top = `${rect.bottom + window.scrollY}px`;
        this.calendar.style.left = `${rect.left + window.scrollX}px`;

        document.body.appendChild(this.calendar);
        this.renderCalendar();
    }

    private close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        if (this.calendar) {
            this.calendar.remove();
            this.calendar = null;
        }
    }

    private renderCalendar() {
        if (!this.calendar) return;
        const y = this.currentDate.getFullYear();
        const m = this.currentDate.getMonth();

        this.calendar.innerHTML = `
            <div class="dp-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <button class="btn-secondary btn-small" id="dp-prev">&lt;</button>
                <div style="font-weight:600; color:var(--color-primary);">${new Date(y, m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                <button class="btn-secondary btn-small" id="dp-next">&gt;</button>
            </div>
            <div class="dp-grid" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; text-align:center;">
                ${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<div style="font-size:0.75rem; color:#64748b; font-weight:600; padding-bottom:4px;">${d}</div>`).join('')}
            </div>
            <div class="dp-days" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px;"></div>
        `;

        const daysContainer = this.calendar.querySelector('.dp-days')!;
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const startDay = new Date(y, m, 1).getDay();

        // Empties
        for (let i = 0; i < startDay; i++) daysContainer.appendChild(document.createElement('div'));

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(y, m, i);
            // Fix: Use local date construction to avoid timezone off-by-one errors from toISOString()
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dStr = `${year}-${month}-${day}`;
            const el = document.createElement('div');
            el.textContent = i.toString();
            el.className = 'cal-day'; // Reuse existing cal styles
            el.style.fontSize = '0.85rem';

            // Highlight selected if matches input value
            if (this.input.value === dStr) {
                el.style.backgroundColor = 'var(--color-primary)';
                el.style.color = 'white';
            }

            el.addEventListener('click', () => {
                this.input.value = dStr;
                this.close();
                // Trigger change event manually
                this.input.dispatchEvent(new Event('change'));
                this.input.dispatchEvent(new Event('input'));
            });
            daysContainer.appendChild(el);
        }

        // Listeners
        this.calendar.querySelector('#dp-prev')!.addEventListener('click', (e) => {
            e.stopPropagation();
            this.currentDate.setMonth(m - 1);
            this.renderCalendar();
        });
        this.calendar.querySelector('#dp-next')!.addEventListener('click', (e) => {
            e.stopPropagation();
            this.currentDate.setMonth(m + 1);
            this.renderCalendar();
        });
    }
}
