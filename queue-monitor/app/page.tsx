import { WalletConnection } from './components/WalletConnection'

export default function Home() {
  return (
    <div className="hero">
      <div className="container">
        <div>
          <h1 className="title">
            Hello World! 🌍
          </h1>
          <div className="card">
            <h2 className="subtitle">
              Welcome to SUI Walrus
            </h2>
            <p className="description">
              This is a Next.js static site with Static Site Generation (SSG) 
              deployed on SUI Walrus - a decentralized storage network.
            </p>
            <div className="grid">
              <div className="feature feature-blue">
                <h3 className="feature-title">⚡ Fast</h3>
                <p className="feature-text">
                  Pre-rendered static pages for lightning-fast loading
                </p>
              </div>
              <div className="feature feature-purple">
                <h3 className="feature-title">🔗 Decentralized</h3>
                <p className="feature-text">
                  Hosted on SUI Walrus distributed storage network
                </p>
              </div>
            </div>
            
            {/* Wallet Connection Section */}
            <WalletConnection />
            
            <div className="footer">
              <p>
                Built with Next.js • Deployed on SUI Walrus • Generated at {new Date().toISOString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
