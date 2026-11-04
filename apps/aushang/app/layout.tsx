import type { Metadata } from 'next';
export const metadata: Metadata={title:'aushang. – Digitale Gesetzesaushänge',description:'Gesetzessammlung mit einem eigenen Zugang für Ihren Standort.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="de"><body>{children}</body></html>}
