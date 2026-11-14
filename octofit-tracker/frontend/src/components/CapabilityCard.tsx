import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';

type ApiRecord = Record<string, unknown>;
type Props = { title: string; description: string; endpoint: string; dataKey: string };

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

export function CapabilityCard({ title, description, endpoint, dataKey }: Props) {
  const [items, setItems] = useState<ApiRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getJson<Record<string, unknown>>(endpoint)
      .then((response) => {
        const records = response[dataKey];
        if (!Array.isArray(records) || !records.every(isRecord)) {
          throw new Error(`Invalid ${dataKey} response`);
        }
        if (active) setItems(records);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Request failed');
      });

    return () => { active = false; };
  }, [dataKey, endpoint]);

  return <section className="card h-100"><div className="card-body">
    <h2 className="h4">{title}</h2>
    <p>{description}</p>
    {items === null && error === null && <p role="status">Loading {title.toLowerCase()}...</p>}
    {error !== null && <p role="alert">Unable to load {title.toLowerCase()}: {error}</p>}
    {items !== null && items.length === 0 && <p>No {title.toLowerCase()} available.</p>}
    {items !== null && items.length > 0 && <ul>
      {items.map((item, index) => <li key={String(item._id ?? index)}>
        {Object.entries(item)
          .filter(([key, value]) => key !== '_id' && key !== '__v' && value != null)
          .map(([key, value]) => <span key={key} className="me-2">{key}: {formatValue(value)}</span>)}
      </li>)}
    </ul>}
  </div></section>;
}
