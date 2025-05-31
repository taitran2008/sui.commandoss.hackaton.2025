'use client'

import { WalletConnection } from './components/WalletConnection'
import { JobSubmission } from './components/JobSubmission'
import { JobMonitor } from './components/JobMonitor'

export default function Home() {
  const handleJobSubmitted = (jobId: string) => {
    console.log('Job submitted:', jobId)
    // You can add additional logic here, like refreshing the monitor
  }

  return (
    <div className="hero">
      <div className="container">
        <div>
          <h1 className="title">
            Queue System on SUI Testnet
          </h1>
          
          {/* Wallet Connection Section */}
          <div className="card">
            <WalletConnection />
          </div>

          {/* Job Submission Section */}
          <div className="card">
            <JobSubmission onJobSubmitted={handleJobSubmitted} />
          </div>

          {/* Job Monitoring Section */}
          <div className="card">
            <JobMonitor />
          </div>
        </div>
      </div>
    </div>
  )
}
