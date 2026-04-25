import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, setToken } from '../auth.js'

const SCOUT_TREE_URL = '/api/scout-tree'

function getTeamsUrl(unitId) {
  return `/api/scout-teams?UnitId=${unitId}`
}

function getTeamName(team) {
  return team.nameFr || team.nameEn || team.nameAr || team.name || ''
}

export default function MemberProfile({ onComplete }) {
  const navigate = useNavigate()

  const [tree, setTree] = useState([])
  const [teams, setTeams] = useState([])

  const [loadingTree, setLoadingTree] = useState(true)
  const [loadingTeams, setLoadingTeams] = useState(false)

  const [form, setForm] = useState({
    districtId: '',
    district: '',
    groupId: '',
    groupName: '',
    unitId: '',
    unit: '',
    teamId: '',
    team: ''
  })

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadScoutTree() {
      try {
        setLoadingTree(true)
        setError('')

        const res = await fetch(SCOUT_TREE_URL)

        if (!res.ok) {
          throw new Error('Impossible de charger les données scoutes')
        }

        const data = await res.json()

        const districtsList =
          Array.isArray(data)
            ? data
            : data.data || data.districts || data.items || []

        setTree(districtsList)
      } catch (err) {
        setError(err.message || 'Impossible de charger les districts')
      } finally {
        setLoadingTree(false)
      }
    }

    loadScoutTree()
  }, [])

  const selectedDistrict = useMemo(() => {
    return tree.find(district => String(district.id) === String(form.districtId))
  }, [tree, form.districtId])

  const availableGroups = selectedDistrict?.groups || []

  const selectedGroup = useMemo(() => {
    return availableGroups.find(group => String(group.id) === String(form.groupId))
  }, [availableGroups, form.groupId])

  const availableUnits = selectedGroup?.units || []

  function handleDistrictChange(districtId) {
    const district = tree.find(item => String(item.id) === String(districtId))

    setForm(prev => ({
      ...prev,
      districtId,
      district: district?.name || '',
      groupId: '',
      groupName: '',
      unitId: '',
      unit: '',
      teamId: '',
      team: ''
    }))

    setTeams([])
    setError('')
  }

  function handleGroupChange(groupId) {
    const group = availableGroups.find(item => String(item.id) === String(groupId))

    setForm(prev => ({
      ...prev,
      groupId,
      groupName: group?.name || '',
      unitId: '',
      unit: '',
      teamId: '',
      team: ''
    }))

    setTeams([])
    setError('')
  }

  async function handleUnitChange(unitId) {
    const unit = availableUnits.find(item => String(item.id) === String(unitId))

    setForm(prev => ({
      ...prev,
      unitId,
      unit: unit?.name || '',
      teamId: '',
      team: ''
    }))

    setTeams([])
    setError('')

    if (!unitId) return

    try {
      setLoadingTeams(true)

      const res = await fetch(getTeamsUrl(unitId))

      if (!res.ok) {
        throw new Error('Impossible de charger les patrouilles')
      }

      const data = await res.json()

      const teamsList =
        Array.isArray(data)
          ? data
          : data.data || data.teams || data.items || []

      setTeams(teamsList)
    } catch (err) {
      setError(err.message || 'Impossible de charger les patrouilles')
    } finally {
      setLoadingTeams(false)
    }
  }

  function handleTeamChange(teamId) {
    const selectedTeam = teams.find(item => String(item.id) === String(teamId))

    setForm(prev => ({
      ...prev,
      teamId,
      team: selectedTeam ? getTeamName(selectedTeam) : ''
    }))

    setError('')
  }

  async function submit(e) {
    e.preventDefault()

    if (
      !form.district ||
      !form.groupName ||
      !form.unit ||
      !form.teamId ||
      !form.team
    ) {
      setError('Veuillez sélectionner tous les champs')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await apiFetch('/api/member/profile', {
        method: 'POST',
        body: JSON.stringify({
          district: form.district,
          groupName: form.groupName,
          unite: form.unit,
          patrouille: form.team,
          teamId: form.teamId
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Impossible d’enregistrer vos informations')
      }

      if (data.token) {
        setToken(data.token)
      }

      if (onComplete) {
        onComplete({
          role: 'member',
          profileComplete: true,
          patrouille: data.patrouille || form.team,
          participantId: data.participantId,
          teamId: form.teamId
        })
      }

      navigate('/waiting')
    } catch (err) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setSaving(false)
    }
  }

return (
  <div className="app-shell">
    <div className="card member-profile-card">
      <div className="member-profile-header">
        <div className="brand-mark">RADIO SCOUT</div>

        <h1 className="member-profile-title">
          Informations du membre
        </h1>

        <p className="muted member-profile-subtitle">
          Veuillez sélectionner votre district, groupe, unité et patrouille
          avant d’accéder à la salle d’attente.
        </p>
      </div>

      <form onSubmit={submit} className="form">
        <div className="member-form-grid">
          <label>
            District
            <select
              value={form.districtId}
              onChange={(e) => handleDistrictChange(e.target.value)}
              disabled={loadingTree}
            >
              <option value="">
                {loadingTree ? 'Chargement des districts...' : 'Sélectionnez un district'}
              </option>

              {tree.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Groupe
            <select
              value={form.groupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              disabled={!form.districtId}
            >
              <option value="">Sélectionnez un groupe</option>

              {availableGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Unité
            <select
              value={form.unitId}
              onChange={(e) => handleUnitChange(e.target.value)}
              disabled={!form.groupId}
            >
              <option value="">Sélectionnez une unité</option>

              {availableUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Patrouille
            <select
              value={form.teamId}
              onChange={(e) => handleTeamChange(e.target.value)}
              disabled={!form.unitId || loadingTeams}
            >
              <option value="">
                {loadingTeams ? 'Chargement des patrouilles...' : 'Sélectionnez une patrouille'}
              </option>

              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {getTeamName(team)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <div className="error">{error}</div>}

        <button className="member-submit" type="submit" disabled={saving || loadingTree || loadingTeams}>
          {saving ? 'Enregistrement...' : 'Continuer'}
        </button>
      </form>
    </div>
  </div>
)
}
