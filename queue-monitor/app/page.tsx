import { WalletConnection } from './components/WalletConnection'

export default function Home() {
  return (
    <div className="hero">
      <div className="container">
        <div>
          <h1 className="title">
            Queue System on SUI Testnet
          </h1>
          <div className="card">
            {/* Wallet Connection Section */}
            <WalletConnection />
          </div>
        </div>
      </div>
    </div>
  )
}
