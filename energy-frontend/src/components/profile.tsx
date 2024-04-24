import ProfileIcon from "./icons/profileIcon"

interface ProfileProps {
    click: () => void
}

export default function Profile({ click}: ProfileProps) {
    return (
        <button onClick={click}>
            <div className="w-50 h-50 flex-shrink-0">
                
                <ProfileIcon />
            </div>
        </button>
    )
}