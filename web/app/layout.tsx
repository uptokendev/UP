import './globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';

export const metadata={title:'$UP',description:'Hold, climb, claim.'} as const; 
export default function RootLayout({children}:{children:React.ReactNode})
{return(<html lang='en'><body className="body-glow">{children}</body></html>);}