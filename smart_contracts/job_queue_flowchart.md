# Job Queue System - Mermaid Flowchart

## Overall System Architecture

```mermaid
graph TB
    subgraph "Initialization"
        A[Contract Deployment] --> B[JobQueueManager Created]
        B --> C[Shared Object Available]
    end
    
    subgraph "Job Lifecycle"
        D[Job Submission] --> E[Job Processing] --> F[Job Completion/Failure]
    end
    
    subgraph "Worker Management"
        G[Worker Registration] --> H[Job Fetching] --> I[Job Processing]
    end
    
    C --> D
    C --> G
```

## Detailed Job Submission Flow

```mermaid
flowchart TD
    A[User Submits Job] --> B{Validate Input}
    B -->|Invalid| C[Throw Error]
    B -->|Valid| D[Calculate Stake Amount]
    D --> E[Add Stake to Treasury]
    E --> F[Create Job Object]
    F --> G[Store Job in Manager]
    G --> H[Add Job to Queue]
    H --> I[Increment Total Jobs]
    I --> J[Emit JobSubmitted Event]
    J --> K[Job Successfully Submitted]
    
    subgraph "Validation Rules"
        V1[Payload ≤ 4KB]
        V2[Queue Name ≤ 255 chars]
        V3[Queue Name Not Empty]
    end
    
    B --> V1
    B --> V2
    B --> V3
```

## Worker Registration and Job Fetching Flow

```mermaid
flowchart TD
    A[Worker Registers] --> B{Validate Batch Size}
    B -->|Invalid| C[Throw Error]
    B -->|Valid| D[Create WorkerSubscription]
    D --> E[Transfer to Worker]
    
    F[Worker Fetches Jobs] --> G{Check Queue Access}
    G -->|Unauthorized| H[Throw Error]
    G -->|Authorized| I[Find Highest Stake Jobs]
    I --> J[Reserve Jobs for Worker]
    J --> K[Emit JobReserved Events]
    K --> L[Return Job UUIDs]
    
    subgraph "Priority System"
        P1[First Pass: Find Highest Stake]
        P2[Second Pass: Collect Jobs by Creation Time]
        P3[Limit by Batch Size]
    end
    
    I --> P1
    P1 --> P2
    P2 --> P3
    P3 --> J
```

## Job Processing States and Transitions

```mermaid
stateDiagram-v2
    [*] --> PENDING : Job Submitted
    PENDING --> RESERVED : Worker Fetches Job
    RESERVED --> COMPLETED : complete_job()
    RESERVED --> PENDING : fail_job() (attempts < max)
    RESERVED --> DLQ : fail_job() (attempts ≥ max)
    RESERVED --> PENDING : Visibility Timeout Expired
    COMPLETED --> [*]
    DLQ --> [*]
    
    note right of PENDING : Available for workers
    note right of RESERVED : Locked by worker
    note right of COMPLETED : Successfully processed
    note right of DLQ : Dead Letter Queue
```

## Job Processing Flow (Worker Perspective)

```mermaid
flowchart TD
    A[Worker Calls fetch_jobs] --> B[Get Jobs from Queue]
    B --> C{Jobs Available?}
    C -->|No| D[Return Empty List]
    C -->|Yes| E[Process Each Job]
    
    E --> F{Processing Successful?}
    F -->|Yes| G[Call complete_job]
    F -->|No| H[Call fail_job]
    
    G --> I[Job Marked as COMPLETED]
    G --> J[Remove from Queue]
    G --> K[Emit JobCompleted Event]
    
    H --> L{Max Attempts Reached?}
    L -->|No| M[Job Marked as PENDING]
    L -->|Yes| N[Job Marked as DLQ]
    M --> O[Job Available for Retry]
    N --> P[Remove from Queue]
    H --> Q[Emit JobFailed Event]
    
    subgraph "Job Status Updates"
        I
        M
        N
    end
```

## Priority System Detail

```mermaid
flowchart LR
    A[Jobs in Queue] --> B[Group by Stake Amount]
    B --> C[Sort by Creation Time within Each Group]
    C --> D[Select Highest Stake Group]
    D --> E[Take Jobs by FIFO Order]
    E --> F[Respect Batch Size Limit]
    
    subgraph "Priority Rules"
        R1[Higher $SUI Stake = Higher Priority]
        R2[Same Stake = FIFO by created_at]
        R3[Batch Size Limits Results]
    end
```

## Error Handling and Edge Cases

```mermaid
flowchart TD
    A[Function Called] --> B{Input Validation}
    B -->|Fail| C[Throw Specific Error]
    B -->|Pass| D[Execute Logic]
    
    D --> E{Job Exists?}
    E -->|No| F[E_JOB_NOT_FOUND]
    E -->|Yes| G{Authorized?}
    G -->|No| H[E_UNAUTHORIZED_ACCESS]
    G -->|Yes| I[Continue Processing]
    
    I --> J{Business Logic Success?}
    J -->|No| K[Handle Error State]
    J -->|Yes| L[Emit Success Event]
    
    subgraph "Error Codes"
        E1[E_INVALID_PAYLOAD_SIZE: 1]
        E2[E_INVALID_QUEUE_NAME: 2]
        E3[E_JOB_NOT_FOUND: 3]
        E4[E_INVALID_BATCH_SIZE: 7]
        E5[E_UNAUTHORIZED_ACCESS: 8]
    end
```

## Admin Functions Flow

```mermaid
flowchart TD
    A[Admin Updates Settings] --> B{Function Type}
    B -->|Visibility Timeout| C[Update visibility_timeout]
    B -->|Max Attempts| D[Update max_attempts]
    
    C --> E[Setting Updated]
    D --> E
    
    subgraph "Admin Settings"
        S1[Visibility Timeout: How long jobs stay reserved]
        S2[Max Attempts: Retry limit before DLQ]
    end
    
    note right of E : In production, would check admin permissions
```

## Data Structures Overview

```mermaid
erDiagram
    JobQueueManager ||--o{ Job : contains
    JobQueueManager ||--o{ Queue : manages
    WorkerSubscription }|--|| Worker : belongs_to
    WorkerSubscription }|--o{ Queue : subscribes_to
    
    JobQueueManager {
        UID id
        Table jobs
        Table queue_jobs
        u64 total_jobs
        u64 visibility_timeout
        u64 max_attempts
        Balance treasury
    }
    
    Job {
        UID id
        String uuid
        String queue
        String payload
        u16 attempts
        Option reserved_at
        u64 available_at
        u64 created_at
        u8 status
        Option error_message
        address submitter
        u64 priority_stake
    }
    
    WorkerSubscription {
        UID id
        address worker
        vector subscribed_queues
        u64 batch_size
        u64 visibility_timeout
    }
```

## Event Flow

```mermaid
sequenceDiagram
    participant U as User/Submitter
    participant C as Contract
    participant W as Worker
    participant E as Event System
    
    U->>C: submit_job(uuid, queue, payload, stake)
    C->>E: emit JobSubmitted
    
    W->>C: register_worker(queues, batch_size)
    C->>W: return WorkerSubscription
    
    W->>C: fetch_jobs(queue_name)
    C->>E: emit JobReserved (for each job)
    C->>W: return job_uuids[]
    
    alt Job Success
        W->>C: complete_job(job_uuid)
        C->>E: emit JobCompleted
    else Job Failure
        W->>C: fail_job(job_uuid, error_msg)
        C->>E: emit JobFailed
    end
```
