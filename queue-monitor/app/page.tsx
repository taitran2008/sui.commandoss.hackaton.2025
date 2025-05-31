'use client'

import { WalletConnection } from './components/WalletConnection'
import { JobSubmission } from './components/JobSubmission'
import { JobMonitor } from './components/JobMonitor'
import { WorkerManagement } from './components/WorkerManagement'

export default function Home() {
  const handleJobSubmitted = (jobId: string) => {
    console.log('Job submitted:', jobId)
    // You can add additional logic here, like refreshing the monitor
  }

  const handleWorkerRegistered = (subscriptionId: string) => {
    console.log('Worker registered:', subscriptionId)
    // You can add additional logic here
  }

  return (
    <div className="hero">
      <div className="container">
        <div>
          <h1 className="title">
            SUI Job Queue System
          </h1>
          <p className="subtitle">
            Decentralized job processing with SUI staking and priority queues
          </p>
          
          {/* Wallet Connection Section */}
          <div className="card">
            <WalletConnection />
          </div>

          {/* Job Submission Section */}
          <div className="card">
            <JobSubmission onJobSubmitted={handleJobSubmitted} />
          </div>

          {/* Worker Management Section */}
          <div className="card">
            <WorkerManagement onWorkerRegistered={handleWorkerRegistered} />
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
