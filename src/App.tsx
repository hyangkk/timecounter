import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'
import type { User } from '@supabase/supabase-js'

function formatTime(sec: number) {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0')
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

interface RecordItem {
  id: number
  start: number
  end: number
  duration: number
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const userId = user?.id
  const [records, setRecords] = useState<RecordItem[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [timerId, setTimerId] = useState<number | null>(null)
  const [manualSec, setManualSec] = useState('')
  const [manualDate, setManualDate] = useState(() => {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  })
  const [adding, setAdding] = useState(false)
  const [openDetail, setOpenDetail] = useState<string | null>(null)
  const [showManualInput, setShowManualInput] = useState(false)

  // 날짜별로 기록 그룹핑 (KST 기준)
  const recordsByDate: { [date: string]: RecordItem[] } = {}
  records.forEach(r => {
    const d = new Date(r.start)
    const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
    if (!recordsByDate[dateStr]) recordsByDate[dateStr] = []
    recordsByDate[dateStr].push(r)
  })
  const today = new Date()
  const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0')
  const todayTotal = recordsByDate[todayStr]?.reduce((acc, cur) => acc + cur.duration, 0) || 0
  const sortedDates = Object.keys(recordsByDate).sort((a, b) => b.localeCompare(a))

  // Supabase에서 기록 불러오기
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('records')
        .select('*')
        .eq('user_id', userId)
        .order('start', { ascending: false })
      if (data) setRecords(data)
    })()
  }, [userId])

  // Supabase Auth 세션 관리
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // 스톱워치 시작
  const handleStart = () => {
    setIsRunning(true)
    const now = Date.now()
    setStartTime(now)
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - now) / 1000))
    }, 1000)
    setTimerId(id)
  }

  // 스톱워치 종료
  const handleStop = async () => {
    setIsRunning(false)
    if (timerId) clearInterval(timerId)
    if (startTime && userId) {
      const end = Date.now()
      const duration = Math.floor((end - startTime) / 1000)
      const { data } = await supabase.from('records').insert([
        { user_id: userId, start: startTime, end, duration }
      ]).select()
      if (data) setRecords([data[0], ...records])
      setElapsed(0)
      setStartTime(null)
    }
  }

  // 기록 삭제
  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    if (!userId) return
    await supabase.from('records').delete().eq('id', id).eq('user_id', userId)
    setRecords(records.filter(r => r.id !== id))
  }

  // 기록 수정
  const handleEdit = async (id: number) => {
    const newSec = prompt('수정할 시간을 초 단위로 입력하세요:')
    if (!newSec) return
    const sec = parseInt(newSec)
    if (isNaN(sec) || sec < 0) return alert('올바른 숫자를 입력하세요.')
    if (!userId) return
    await supabase.from('records').update({ duration: sec }).eq('id', id).eq('user_id', userId)
    setRecords(records.map(r => r.id === id ? { ...r, duration: sec } : r))
  }

  // KST 기준 날짜를 ms로 변환 (타임존 버그 완전 방지)
  function getKstMs(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d, 0, 0, 0).getTime()
  }

  // 수동 기록 추가
  const handleAddManual = async () => {
    const sec = parseInt(manualSec)
    if (isNaN(sec) || sec <= 0) {
      alert('양의 정수를 입력하세요.')
      return
    }
    if (!userId) return
    setAdding(true)
    const ms = getKstMs(manualDate)
    const { data } = await supabase.from('records').insert([
      { user_id: userId, start: ms, end: ms, duration: sec }
    ]).select()
    if (data) setRecords([data[0], ...records])
    setManualSec('')
    setAdding(false)
  }

  // 구글 로그인
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }
  // 로그아웃
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // 로그인 상태가 아니면 로그인 버튼과 제목만 노출
  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f7f7f7' }}>
        <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 40, color: '#222', letterSpacing: '-1px' }}>업무 시간 기록</div>
        <button onClick={handleLogin} style={{ fontSize: 20, fontWeight: 700, padding: '16px 40px', borderRadius: 12, background: '#fff', color: '#222', border: '1px solid #bbb', boxShadow: '0 2px 8px #0001', cursor: 'pointer' }}>
          Google로 로그인
        </button>
      </div>
    )
  }

  return (
    <div className="container" style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      {/* 오늘/지금 관련 정보 맨 위 */}
      <div style={{ margin: '0 0 32px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>오늘 누적 시간</div>
        <div style={{ fontSize: 40, fontWeight: 900, color: '#222', marginBottom: 4 }}>{formatTime(todayTotal)}</div>
        <div style={{ fontSize: 15, color: '#888', marginBottom: 16 }}>{(recordsByDate[todayStr]?.length || 0)}회</div>
        <div className="stopwatch-circle" style={{
          margin: '0 auto 16px auto',
          width: 320,
          height: 320,
          background: '#222',
          borderRadius: '50%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'white', marginBottom: 12, letterSpacing: '-1px' }}>시간 합계</div>
          <div style={{ fontSize: 48, fontWeight: 800, color: 'white', marginBottom: 32, letterSpacing: '2px' }}>{formatTime(isRunning ? elapsed : 0)}</div>
          <button
            className="stopwatch-btn"
            onClick={isRunning ? handleStop : handleStart}
            style={{
              fontSize: 26,
              fontWeight: 700,
              padding: '18px 48px',
              borderRadius: 999,
              background: '#fff',
              color: '#222',
              border: 'none',
              boxShadow: '0 2px 8px #0002',
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s',
              outline: 'none',
              letterSpacing: '0.5px',
              marginTop: 0,
              marginBottom: 0,
              display: 'block',
            }}
          >
            {isRunning ? '종료' : '시작'}
          </button>
        </div>
      </div>
      {/* 날짜별 누적 시간 표 + 자세히 보기 (오늘 포함, 오늘이 맨 위) */}
      <div style={{ margin: '32px 0 16px 0', fontWeight: 700, fontSize: 20 }}>기록</div>
      <table style={{ width: '100%', maxWidth: 400, margin: '0 auto 24px auto', borderCollapse: 'collapse', background: '#fafbfc' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ padding: 8, border: '1px solid #ddd' }}>날짜</th>
            <th style={{ padding: 8, border: '1px solid #ddd' }}>누적 시간</th>
            <th style={{ padding: 8, border: '1px solid #ddd' }}></th>
          </tr>
        </thead>
        <tbody>
          {[todayStr, ...sortedDates.filter(dateStr => dateStr !== todayStr)].map(dateStr => {
            const total = recordsByDate[dateStr]?.reduce((acc, cur) => acc + cur.duration, 0) || 0
            return (
              <>
                <tr key={dateStr} style={dateStr === todayStr ? { background: '#eaf6ff' } : {}}>
                  <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center', fontWeight: dateStr === todayStr ? 700 : 400 }}>
                    {dateStr === todayStr ? '오늘' : dateStr}
                  </td>
                  <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center', fontWeight: dateStr === todayStr ? 700 : 400 }}>
                    {formatTime(total)}
                  </td>
                  <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>
                    <button onClick={() => setOpenDetail(openDetail === dateStr ? null : dateStr)} style={{fontSize:15, fontWeight:600, padding:'6px 16px', borderRadius:6, border:'1px solid #aaa', background:'#fff', cursor:'pointer'}}>
                      {openDetail === dateStr ? '닫기' : '자세히 보기'}
                    </button>
                  </td>
                </tr>
                {openDetail === dateStr && (
                  <tr>
                    <td colSpan={3} style={{ background:'#f9f9f9', padding:12 }}>
                      <ul style={{margin:0}}>
                        {recordsByDate[dateStr]?.map((rec) => (
                          <li key={rec.id}>
                            {formatTime(rec.duration)}
                            {rec.start !== rec.end && (
                              <> (시작: {new Date(rec.start).toLocaleTimeString()} ~ 종료: {new Date(rec.end).toLocaleTimeString()})</>
                            )}
                            <button onClick={() => handleEdit(rec.id)} style={{marginLeft:8}}>수정</button>
                            <button onClick={() => handleDelete(rec.id)} style={{marginLeft:4}}>삭제</button>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
      {/* 수동 기록 입력 UI - 맨 아래 */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '32px 0 0 0' }}>
        <button
          onClick={() => setShowManualInput(v => !v)}
          style={{ fontSize: 15, fontWeight: 600, padding: '8px 18px', borderRadius: 8, background: '#f5f5f5', color: '#333', border: '1px solid #bbb', cursor: 'pointer', marginRight: 8 }}
        >
          수동 기록 추가
        </button>
        {showManualInput && (
          <>
            <input
              type="number"
              min={1}
              placeholder="초 단위로 입력"
              value={manualSec}
              onChange={e => setManualSec(e.target.value)}
              style={{ fontSize: 16, padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc', marginRight: 8, width: 100 }}
            />
            <input
              type="date"
              value={manualDate}
              onChange={e => setManualDate(e.target.value)}
              style={{ fontSize: 16, padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc', marginRight: 8 }}
            />
            <button
              onClick={handleAddManual}
              disabled={adding}
              style={{ fontSize: 15, fontWeight: 600, padding: '8px 18px', borderRadius: 8, background: '#1a1a1a', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              입력
            </button>
          </>
        )}
      </div>
      {/* 로그아웃 버튼 - 맨 아래 */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0 0 0' }}>
        <button onClick={handleLogout} style={{ fontSize: 16, fontWeight: 700, padding: '12px 36px', borderRadius: 12, background: '#eee', color: '#333', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px #0001' }}>
          로그아웃
        </button>
      </div>
    </div>
  )
}

export default App
