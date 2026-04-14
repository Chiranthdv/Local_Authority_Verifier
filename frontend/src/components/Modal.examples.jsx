// Modal Component Usage Examples
//
// Basic Modal:
// <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="My Modal">
//   <p>Modal content goes here</p>
// </Modal>
//
// Modal with custom size:
// <Modal isOpen={isOpen} onClose={onClose} title="Large Modal" size="large">
//   <div>Large modal content</div>
// </Modal>
//
// Modal without close button:
// <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false}>
//   <p>Cannot be closed by user</p>
// </Modal>
//
// Modal with form:
// <Modal isOpen={isOpen} onClose={onClose} title="Edit Item">
//   <form onSubmit={handleSubmit}>
//     <input type="text" placeholder="Name" />
//     <Button type="submit">Save</Button>
//   </form>
// </Modal>